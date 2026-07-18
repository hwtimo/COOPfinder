import assert from "node:assert/strict";
import test from "node:test";

import {
  createExtractAndPersistOwnedJob,
  extractAndPersistOwnedJob,
  type ExtractAndPersistOwnedJobDependencies,
} from "../../lib/ai/extract-and-persist-owned-job";
import type { ExtractOwnedJobDescriptionResult } from "../../lib/ai/extract-owned-job-description";
import {
  createJobExtractionPersistence,
  type JobExtractionPersistenceDependencies,
  type PersistJobExtractionResult,
} from "../../lib/ai/persist-job-extraction";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  type JobExtractionV1,
} from "../../lib/ai/schemas/job-extraction";
import { normalizeJobRequirements } from "../../lib/jobs/job-requirement-normalization";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

const CANONICAL_EXTRACTION: JobExtractionV1 = {
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

const EXTRACTION_SUCCESS: ExtractOwnedJobDescriptionResult = {
  status: "success",
  extraction: CANONICAL_EXTRACTION,
  canonicalRequirements: normalizeJobRequirements(CANONICAL_EXTRACTION),
  reviewClassification: "normal_review",
};

function bridgeDependencies(
  overrides: Partial<ExtractAndPersistOwnedJobDependencies> = {},
): ExtractAndPersistOwnedJobDependencies {
  return {
    extractOwnedJob: async () => EXTRACTION_SUCCESS,
    persistExtraction: async () => ({ status: "updated" }),
    ...overrides,
  };
}

function persistenceDependencies(
  data: unknown,
): JobExtractionPersistenceDependencies {
  return {
    invokeRpc: async () => ({ status: "response", data }),
  };
}

test("successful extraction followed by updated returns persisted", async () => {
  const orchestrate = createExtractAndPersistOwnedJob(bridgeDependencies());

  assert.deepEqual(await orchestrate(JOB_ID), { status: "persisted" });
});

test("successful extraction followed by unchanged returns already persisted", async () => {
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      persistExtraction: async () => ({ status: "unchanged" }),
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "already_persisted",
  });
});

test("extraction-stage failure causes no persistence call", async () => {
  let persistenceCalls = 0;
  const extractionFailure: ExtractOwnedJobDescriptionResult = {
    status: "provider_unavailable",
    reason: "provider_unavailable",
    retryable: true,
  };
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      extractOwnedJob: async () => extractionFailure,
      persistExtraction: async () => {
        persistenceCalls += 1;
        return { status: "updated" };
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "provider_unavailable",
  });
  assert.equal(persistenceCalls, 0);
});

const safeExtractionMappings: Array<{
  extraction: ExtractOwnedJobDescriptionResult;
  expectedStatus:
    | "unauthenticated"
    | "invalid_job_id"
    | "configuration_unavailable"
    | "provider_refusal"
    | "invalid_structured_output"
    | "invalid_job_text";
}> = [
  {
    extraction: { status: "unauthenticated", retryable: false },
    expectedStatus: "unauthenticated",
  },
  {
    extraction: { status: "invalid_job_id", retryable: false },
    expectedStatus: "invalid_job_id",
  },
  {
    extraction: {
      status: "configuration_unavailable",
      reason: "model_not_configured",
      retryable: false,
    },
    expectedStatus: "configuration_unavailable",
  },
  {
    extraction: {
      status: "provider_refusal",
      reason: "provider_refusal",
      retryable: false,
    },
    expectedStatus: "provider_refusal",
  },
  {
    extraction: {
      status: "invalid_structured_output",
      reason: "invalid_structured_output",
      retryable: false,
    },
    expectedStatus: "invalid_structured_output",
  },
  {
    extraction: { status: "missing_job_description", retryable: false },
    expectedStatus: "invalid_job_text",
  },
  {
    extraction: {
      status: "invalid_input",
      reason: "input_too_long",
      retryable: false,
    },
    expectedStatus: "invalid_job_text",
  },
];

for (const { extraction, expectedStatus } of safeExtractionMappings) {
  test(`preserves safe ${expectedStatus} extraction mapping without persistence`, async () => {
    let persistenceCalls = 0;
    const orchestrate = createExtractAndPersistOwnedJob(
      bridgeDependencies({
        extractOwnedJob: async () => extraction,
        persistExtraction: async () => {
          persistenceCalls += 1;
          return { status: "updated" };
        },
      }),
    );

    assert.deepEqual(await orchestrate(JOB_ID), { status: expectedStatus });
    assert.equal(persistenceCalls, 0);
  });
}

test("job-unavailable extraction causes no persistence call", async () => {
  let persistenceCalls = 0;
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      extractOwnedJob: async () => ({
        status: "job_unavailable",
        retryable: false,
      }),
      persistExtraction: async () => {
        persistenceCalls += 1;
        return { status: "updated" };
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "job_unavailable",
  });
  assert.equal(persistenceCalls, 0);
});

test("unsupported-source extraction causes no persistence call", async () => {
  let persistenceCalls = 0;
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      extractOwnedJob: async () => ({
        status: "unsupported_intake_source",
        retryable: false,
      }),
      persistExtraction: async () => {
        persistenceCalls += 1;
        return { status: "updated" };
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "unsupported_source",
  });
  assert.equal(persistenceCalls, 0);
});

test("passes the canonical extraction object unchanged to persistence", async () => {
  const receivedExtractions: JobExtractionV1[] = [];
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      persistExtraction: async (_jobId, extraction) => {
        receivedExtractions.push(extraction);
        return { status: "updated" };
      },
    }),
  );

  await orchestrate(JOB_ID);

  assert.equal(receivedExtractions.length, 1);
  assert.equal(receivedExtractions[0], CANONICAL_EXTRACTION);
});

test("RPC helper derives confidence from the validated extraction", async () => {
  const calls: Array<{
    jobId: string;
    extraction: JobExtractionV1;
    overallConfidence: number;
  }> = [];
  const persist = createJobExtractionPersistence({
    invokeRpc: async (input) => {
      calls.push(input);
      return {
        status: "response",
        data: [{ result_status: "updated", job_posting_id: JOB_ID }],
      };
    },
  });

  await persist(JOB_ID, CANONICAL_EXTRACTION);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.extraction, CANONICAL_EXTRACTION);
  assert.equal(calls[0]?.overallConfidence, CANONICAL_EXTRACTION.overallConfidence);
});

test("persistence unavailable row maps safely to job unavailable", async () => {
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      persistExtraction: async () => ({ status: "unavailable" }),
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "job_unavailable",
  });
});

test("persistence unsupported source maps safely", async () => {
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      persistExtraction: async () => ({ status: "unsupported_source" }),
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "unsupported_source",
  });
});

test("persistence invalid input maps to persistence rejected", async () => {
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      persistExtraction: async () => ({ status: "invalid_input" }),
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "persistence_rejected",
  });
});

test("Supabase and RPC failures map to persistence unavailable", async () => {
  const unavailablePersist = createJobExtractionPersistence({
    invokeRpc: async () => ({ status: "unavailable" }),
  });
  const throwingPersist = createJobExtractionPersistence({
    invokeRpc: async () => {
      throw new Error("PRIVATE_SUPABASE_MESSAGE");
    },
  });

  assert.deepEqual(await unavailablePersist(JOB_ID, CANONICAL_EXTRACTION), {
    status: "persistence_unavailable",
  });
  assert.deepEqual(await throwingPersist(JOB_ID, CANONICAL_EXTRACTION), {
    status: "persistence_unavailable",
  });
});

test("unknown or malformed RPC responses fail closed", async () => {
  const responses = [
    [{ result_status: "future_status", job_posting_id: JOB_ID }],
    [{ result_status: "updated", job_posting_id: null }],
    [],
    [
      { result_status: "updated", job_posting_id: JOB_ID },
      { result_status: "updated", job_posting_id: JOB_ID },
    ],
    null,
  ];

  for (const response of responses) {
    const persist = createJobExtractionPersistence(
      persistenceDependencies(response),
    );
    assert.deepEqual(await persist(JOB_ID, CANONICAL_EXTRACTION), {
      status: "persistence_unavailable",
    });
  }
});

test("failure results contain no private or provider details", async () => {
  const markers = [
    "PRIVATE_RAW_JD",
    "PRIVATE_PROVIDER_DATA",
    "PRIVATE_SUPABASE_MESSAGE",
    "PRIVATE_STACK_TRACE",
  ];
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      persistExtraction: async () => {
        throw new Error(markers.join(" "));
      },
    }),
  );

  const serialized = JSON.stringify(await orchestrate(JOB_ID));

  for (const marker of markers) assert.equal(serialized.includes(marker), false);
  assert.equal(serialized.includes("stack"), false);
});

test("persistence is invoked exactly once after one successful extraction", async () => {
  let extractionCalls = 0;
  let persistenceCalls = 0;
  const orchestrate = createExtractAndPersistOwnedJob(
    bridgeDependencies({
      extractOwnedJob: async () => {
        extractionCalls += 1;
        return EXTRACTION_SUCCESS;
      },
      persistExtraction: async () => {
        persistenceCalls += 1;
        return { status: "updated" };
      },
    }),
  );

  await orchestrate(JOB_ID);

  assert.equal(extractionCalls, 1);
  assert.equal(persistenceCalls, 1);
});

test("production bridge accepts exactly one private job ID", () => {
  assert.equal(extractAndPersistOwnedJob.length, 1);
});

test("known RPC rows map without exposing RPC internals", async () => {
  const knownRows: Array<{
    row: unknown;
    expected: PersistJobExtractionResult;
  }> = [
    {
      row: [{ result_status: "updated", job_posting_id: JOB_ID }],
      expected: { status: "updated" },
    },
    {
      row: [{ result_status: "unchanged", job_posting_id: JOB_ID }],
      expected: { status: "unchanged" },
    },
    {
      row: [{ result_status: "unsupported_source", job_posting_id: JOB_ID }],
      expected: { status: "unsupported_source" },
    },
    {
      row: [{ result_status: "invalid_input", job_posting_id: null }],
      expected: { status: "invalid_input" },
    },
    {
      row: [{ result_status: "unavailable", job_posting_id: null }],
      expected: { status: "unavailable" },
    },
  ];

  for (const { row, expected } of knownRows) {
    const persist = createJobExtractionPersistence(persistenceDependencies(row));
    assert.deepEqual(await persist(JOB_ID, CANONICAL_EXTRACTION), expected);
  }
});
