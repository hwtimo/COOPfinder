import assert from "node:assert/strict";
import test from "node:test";

import {
  createExtractAndPersistOwnedJob,
  type ExtractAndPersistOwnedJobResult,
} from "../../lib/ai/extract-and-persist-owned-job";
import {
  createParserAnalysisCreditCoordinator,
  type ParserCreditEnforcedJobResult,
} from "../../lib/ai/parser-analysis-credit-coordinator";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  type JobExtractionV1,
} from "../../lib/ai/schemas/job-extraction";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";
const RESERVATION_ID = "fe751351-250c-4b6d-bcce-b2e4ee640b53";

const EXTRACTION: JobExtractionV1 = {
  contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
  companyName: { value: "Clio", confidence: 0.9 },
  title: { value: "Software Developer Co-op", confidence: 0.9 },
  location: { value: "Vancouver, BC", confidence: 0.8 },
  workMode: { value: "Hybrid", confidence: 0.8 },
  term: { value: "Fall 2026", confidence: 0.8 },
  deadline: { value: null, confidence: 0 },
  namedSkills: { value: ["TypeScript"], confidence: 0.8 },
  responsibilities: { value: [], confidence: 0 },
  requirements: { value: [], confidence: 0 },
  overallConfidence: 0.85,
};

type Counters = {
  provider: number;
  persistence: number;
};

type RpcCall = {
  name: string;
  parameters: Record<string, unknown>;
};

function extractionBridge(
  counters: Counters,
  options: {
    extractionStatus?: "success" | "provider_unavailable";
    persistenceStatus?: "updated" | "unchanged" | "persistence_unavailable";
  } = {},
) {
  return createExtractAndPersistOwnedJob({
    async extractOwnedJob() {
      counters.provider += 1;
      if (options.extractionStatus === "provider_unavailable") {
        return {
          status: "provider_unavailable" as const,
          reason: "provider_unavailable" as const,
          retryable: true,
        };
      }
      return {
        status: "success" as const,
        extraction: EXTRACTION,
        reviewClassification: "normal_review" as const,
      };
    },
    async persistExtraction() {
      counters.persistence += 1;
      return { status: options.persistenceStatus ?? "updated" };
    },
  });
}

function coordinatorHarness(options: {
  reserveStatus?:
    | "reserved"
    | "no_credits"
    | "daily_limit"
    | "unsupported_source"
    | "invalid_input"
    | "unavailable";
  runBridge: (jobId: string) => Promise<ExtractAndPersistOwnedJobResult>;
  finalizeResponses?: Array<{ data: unknown; error: unknown }>;
}) {
  const calls: RpcCall[] = [];
  const diagnostics: string[] = [];
  const finalizeResponses = [...(options.finalizeResponses ?? [])];
  const coordinate = createParserAnalysisCreditCoordinator({
    getRequestContext: async () => ({
      status: "ready" as const,
      async invokeRpc(name: string, parameters: Record<string, unknown>) {
        calls.push({ name, parameters });
        if (name === "reserve_parser_analysis_credit") {
          const status = options.reserveStatus ?? "reserved";
          return {
            data: [
              {
                result_status: status,
                reservation_id: status === "reserved" ? RESERVATION_ID : null,
              },
            ],
            error: null,
          };
        }

        return (
          finalizeResponses.shift() ?? {
            data: [
              {
                result_status: parameters.p_succeeded
                  ? "consumed"
                  : "refunded",
              },
            ],
            error: null,
          }
        );
      },
    }),
    runBridge: options.runBridge,
    reportDiagnostic: (event) => diagnostics.push(event),
  });

  return { coordinate, calls, diagnostics };
}

const blockedMappings: Array<{
  reserveStatus:
    | "no_credits"
    | "daily_limit"
    | "unsupported_source"
    | "invalid_input"
    | "unavailable";
  expected: ParserCreditEnforcedJobResult;
}> = [
  { reserveStatus: "no_credits", expected: { status: "no_credits" } },
  { reserveStatus: "daily_limit", expected: { status: "daily_limit" } },
  {
    reserveStatus: "unsupported_source",
    expected: { status: "unsupported_source" },
  },
  { reserveStatus: "invalid_input", expected: { status: "invalid_job_text" } },
  { reserveStatus: "unavailable", expected: { status: "credit_unavailable" } },
];

for (const { reserveStatus, expected } of blockedMappings) {
  test(`${reserveStatus} blocks provider, persistence, and finalization`, async () => {
    const counters = { provider: 0, persistence: 0 };
    const harness = coordinatorHarness({
      reserveStatus,
      runBridge: extractionBridge(counters),
    });

    assert.deepEqual(await harness.coordinate(JOB_ID), expected);
    assert.deepEqual(counters, { provider: 0, persistence: 0 });
    assert.deepEqual(
      harness.calls.map(({ name }) => name),
      ["reserve_parser_analysis_credit"],
    );
  });
}

test("successful analysis reserves, invokes once, persists once, and consumes", async () => {
  const counters = { provider: 0, persistence: 0 };
  const harness = coordinatorHarness({ runBridge: extractionBridge(counters) });

  const result = await harness.coordinate(JOB_ID);

  assert.deepEqual(result, { status: "persisted" });
  assert.deepEqual(counters, { provider: 1, persistence: 1 });
  assert.deepEqual(
    harness.calls.map(({ name }) => name),
    ["reserve_parser_analysis_credit", "finalize_parser_analysis_credit"],
  );
  assert.equal(harness.calls[1]?.parameters.p_succeeded, true);
  assert.equal(JSON.stringify(result).includes(RESERVATION_ID), false);
  assert.equal(
    harness.calls.some(({ name }) => name.includes("tailoring")),
    false,
  );
});

test("an unchanged successful persistence still consumes the new analysis credit", async () => {
  const counters = { provider: 0, persistence: 0 };
  const harness = coordinatorHarness({
    runBridge: extractionBridge(counters, { persistenceStatus: "unchanged" }),
  });

  assert.deepEqual(await harness.coordinate(JOB_ID), {
    status: "already_persisted",
  });
  assert.equal(harness.calls[1]?.parameters.p_succeeded, true);
});

test("provider failure refunds without persistence and preserves old analysis", async () => {
  const counters = { provider: 0, persistence: 0 };
  const oldAnalysis = { version: "existing" };
  const savedAnalysis = { ...oldAnalysis };
  const harness = coordinatorHarness({
    runBridge: extractionBridge(counters, {
      extractionStatus: "provider_unavailable",
    }),
  });

  assert.deepEqual(await harness.coordinate(JOB_ID), {
    status: "provider_unavailable",
  });
  assert.deepEqual(counters, { provider: 1, persistence: 0 });
  assert.equal(harness.calls[1]?.parameters.p_succeeded, false);
  assert.deepEqual(savedAnalysis, oldAnalysis);
});

test("persistence failure refunds and never reports success", async () => {
  const counters = { provider: 0, persistence: 0 };
  const harness = coordinatorHarness({
    runBridge: extractionBridge(counters, {
      persistenceStatus: "persistence_unavailable",
    }),
  });

  assert.deepEqual(await harness.coordinate(JOB_ID), {
    status: "persistence_unavailable",
  });
  assert.deepEqual(counters, { provider: 1, persistence: 1 });
  assert.equal(harness.calls[1]?.parameters.p_succeeded, false);
});

test("a transport failure retries finalization once without repeating work", async () => {
  const counters = { provider: 0, persistence: 0 };
  const harness = coordinatorHarness({
    runBridge: extractionBridge(counters),
    finalizeResponses: [
      { data: null, error: { code: "transport_failure" } },
      { data: [{ result_status: "consumed" }], error: null },
    ],
  });

  assert.deepEqual(await harness.coordinate(JOB_ID), { status: "persisted" });
  assert.deepEqual(counters, { provider: 1, persistence: 1 });
  assert.equal(
    harness.calls.filter(({ name }) => name === "finalize_parser_analysis_credit")
      .length,
    2,
  );
  assert.deepEqual(harness.diagnostics, []);
});

test("a refund transport failure retries once without repeating provider work", async () => {
  const counters = { provider: 0, persistence: 0 };
  const harness = coordinatorHarness({
    runBridge: extractionBridge(counters, {
      extractionStatus: "provider_unavailable",
    }),
    finalizeResponses: [
      { data: null, error: { code: "transport_failure" } },
      { data: [{ result_status: "refunded" }], error: null },
    ],
  });

  assert.deepEqual(await harness.coordinate(JOB_ID), {
    status: "provider_unavailable",
  });
  assert.deepEqual(counters, { provider: 1, persistence: 0 });
  assert.equal(
    harness.calls.filter(({ name }) => name === "finalize_parser_analysis_credit")
      .length,
    2,
  );
});

test("unconfirmed finalization fails closed after one retry", async () => {
  const counters = { provider: 0, persistence: 0 };
  const harness = coordinatorHarness({
    runBridge: extractionBridge(counters),
    finalizeResponses: [
      { data: null, error: { code: "first_failure" } },
      { data: null, error: { code: "retry_failure" } },
    ],
  });

  assert.deepEqual(await harness.coordinate(JOB_ID), {
    status: "credit_unavailable",
  });
  assert.deepEqual(counters, { provider: 1, persistence: 1 });
  assert.deepEqual(harness.diagnostics, ["consume_unconfirmed"]);
});

test("missing request authentication never invokes RPC or provider", async () => {
  let bridgeCalls = 0;
  const coordinate = createParserAnalysisCreditCoordinator({
    getRequestContext: async () => ({ status: "unauthenticated" }),
    runBridge: async () => {
      bridgeCalls += 1;
      return { status: "persisted" };
    },
    reportDiagnostic: () => undefined,
  });

  assert.deepEqual(await coordinate(JOB_ID), { status: "unauthenticated" });
  assert.equal(bridgeCalls, 0);
});

test("request-context failure blocks the provider with a safe result", async () => {
  let bridgeCalls = 0;
  const coordinate = createParserAnalysisCreditCoordinator({
    getRequestContext: async () => {
      throw new Error("PRIVATE_AUTH_TRANSPORT_DETAIL");
    },
    runBridge: async () => {
      bridgeCalls += 1;
      return { status: "persisted" };
    },
    reportDiagnostic: () => undefined,
  });

  assert.deepEqual(await coordinate(JOB_ID), {
    status: "credit_unavailable",
  });
  assert.equal(bridgeCalls, 0);
});
