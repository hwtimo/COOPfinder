import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import {
  createGenerateOwnedTailoredResumeCoordinator,
} from "../../lib/tailoring/generate-owned-tailored-resume";
import type { OwnedTailoringGenerationSourceResult } from "../../lib/tailoring/get-owned-tailoring-generation-source";
import {
  buildTailoredResumeDocument,
  fingerprintTailoringProviderInputV2,
} from "../../lib/tailoring/tailored-resume-document";
import { buildTailoredResumeVersionContent } from "../../lib/tailoring/tailored-resume-version-content";
import type { TailoringGenerationProviderResult } from "../../lib/tailoring/tailoring-generation-provider";
import { validateTailoringPlanOutputV2 } from "../../lib/tailoring/tailoring-provider-contracts-v2";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "./tailoring-v2-fixtures";

const USER_ID = "a71a0000-0000-4000-8000-000000000001";
const JOB_ID = "b71a0000-0000-4000-8000-000000000001";
const KEY_ID = "c71a0000-0000-4000-8000-000000000001";
const RESERVATION_ID = "d71a0000-0000-4000-8000-000000000001";
const VERSION_ID = "e71a0000-0000-4000-8000-000000000001";
const EXPIRES_AT = "2026-07-20T20:10:00.000Z";

const readySource: OwnedTailoringGenerationSourceResult = {
  status: "ready",
  preflight: readyPreflightV2(),
  resumeSourceSnapshot: resumeSourceSnapshotV2(),
};

type HarnessOptions = Readonly<{
  user?: Readonly<{ id: string }> | null;
  source?: OwnedTailoringGenerationSourceResult;
  reservationStatus?: string;
  providerResult?: TailoringGenerationProviderResult;
  providerThrows?: boolean;
  providerOutput?: unknown;
  finalizationStatus?: string;
  trustedAvailable?: boolean;
  invalidProjection?: boolean;
  invalidDocument?: boolean;
  invalidEnvelope?: boolean;
}>;

function reservationData(status: string) {
  const identified = [
    "reserved",
    "generation_in_progress",
    "already_completed",
    "terminal_refunded",
    "terminal_expired",
  ].includes(status);
  return [{
    result_status: status,
    reservation_id: identified ? RESERVATION_ID : null,
    resume_version_id: status === "already_completed" ? VERSION_ID : null,
    expires_at: identified ? EXPIRES_AT : null,
  }];
}

function finalizationData(status: string) {
  const completed = status === "finalized" || status === "already_completed";
  const identified = completed || ["terminal_refunded", "expired", "invalid_output"].includes(status);
  return [{
    result_status: status,
    reservation_id: identified ? RESERVATION_ID : null,
    resume_version_id: completed ? VERSION_ID : null,
    version_name: completed ? `Product Developer - tailored v2 - ${RESERVATION_ID}` : null,
  }];
}

function harness(options: HarnessOptions = {}) {
  const rpcCalls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
  let providerCalls = 0;
  const coordinator = createGenerateOwnedTailoredResumeCoordinator({
    async getAuthenticatedUser() {
      return options.user === undefined ? { id: USER_ID } : options.user;
    },
    async getGenerationSource() {
      return options.source ?? readySource;
    },
    buildProviderInput: options.invalidProjection
      ? () => ({ status: "invalid_preflight" })
      : buildTailoringProviderInputV2,
    fingerprintInput: fingerprintTailoringProviderInputV2,
    validatePlan: validateTailoringPlanOutputV2,
    buildDocument: options.invalidDocument
      ? () => ({ status: "invalid_document" })
      : buildTailoredResumeDocument,
    buildVersionContent: options.invalidEnvelope
      ? () => ({ status: "invalid" })
      : buildTailoredResumeVersionContent,
    provider: {
      async generatePlan() {
        providerCalls += 1;
        if (options.providerThrows) throw new Error("private provider detail");
        return options.providerResult ?? {
          status: "output",
          output: options.providerOutput ?? validTailoringPlanV2(),
        };
      },
    },
    async getTrustedContext() {
      if (options.trustedAvailable === false) return null;
      return {
        async invokeRpc(name, parameters) {
          rpcCalls.push({ name, parameters });
          if (name === "reserve_tailoring_generation_credit_trusted") {
            return { data: reservationData(options.reservationStatus ?? "reserved"), error: null };
          }
          if (name === "refund_tailoring_generation_reservation_trusted") {
            return {
              data: [{ result_status: "refunded", reservation_id: RESERVATION_ID, resume_version_id: null }],
              error: null,
            };
          }
          return { data: finalizationData(options.finalizationStatus ?? "finalized"), error: null };
        },
      };
    },
  });
  return { coordinator, rpcCalls, providerCalls: () => providerCalls };
}

test("successful v2 generation reserves, invokes once, builds a complete document, and finalizes", async () => {
  const fixture = harness();
  assert.deepEqual(await fixture.coordinator(JOB_ID, KEY_ID), {
    status: "generated",
    resumeVersionId: VERSION_ID,
    versionName: `Product Developer - tailored v2 - ${RESERVATION_ID}`,
  });
  assert.equal(fixture.providerCalls(), 1);
  assert.deepEqual(fixture.rpcCalls.map((call) => call.name), [
    "reserve_tailoring_generation_credit_trusted",
    "finalize_tailored_resume_document_trusted",
  ]);
  assert.equal(fixture.rpcCalls[0].parameters.p_provider_input_contract_version, "tailoring-provider-input-v2");
  assert.equal(fixture.rpcCalls[0].parameters.p_provider_output_contract_version, "tailoring-plan-output-v2");
  const envelope = fixture.rpcCalls[1].parameters.p_version_content as Record<string, unknown>;
  assert.equal(envelope.contractVersion, "tailored-resume-version-content-v2");
  const serialized = JSON.stringify(envelope);
  assert.match(serialized, /Improved latency by 37% in 2025\./);
  assert.doesNotMatch(serialized, /This approved but unselected fragment/);
  assert.doesNotMatch(serialized, /prompt|instructions|diagnostic|rawProfile|rawJob/i);
});

test("authentication, invalid IDs, and non-ready source states stop before reservation", async () => {
  const unauthenticated = harness({ user: null });
  assert.deepEqual(await unauthenticated.coordinator(JOB_ID, KEY_ID), { status: "unauthenticated" });
  assert.deepEqual(await harness().coordinator("bad", KEY_ID), { status: "not_found" });
  assert.deepEqual(await harness().coordinator(JOB_ID, "bad"), { status: "unavailable" });
  for (const status of [
    "not_found",
    "extraction_unavailable",
    "profile_unavailable",
    "invalid_extraction",
    "insufficient_job_data",
    "insufficient_candidate_data",
    "unavailable",
  ] as const) {
    const fixture = harness({ source: { status } });
    assert.deepEqual(await fixture.coordinator(JOB_ID, KEY_ID), { status });
    assert.equal(fixture.providerCalls(), 0);
    assert.equal(fixture.rpcCalls.length, 0);
  }
});

test("reservation outcomes before generation invoke the provider zero times", async () => {
  const cases = [
    ["insufficient_credit", "insufficient_credit"],
    ["generation_in_progress", "generation_in_progress"],
    ["terminal_refunded", "attempt_terminal"],
    ["terminal_expired", "attempt_terminal"],
    ["not_found", "not_found"],
    ["invalid_input", "unavailable"],
  ] as const;
  for (const [reservationStatus, expected] of cases) {
    const fixture = harness({ reservationStatus });
    assert.deepEqual(await fixture.coordinator(JOB_ID, KEY_ID), { status: expected });
    assert.equal(fixture.providerCalls(), 0);
  }
});

test("completed replay retrieves the immutable version with zero provider calls and no refund", async () => {
  const fixture = harness({ reservationStatus: "already_completed", finalizationStatus: "already_completed" });
  assert.equal((await fixture.coordinator(JOB_ID, KEY_ID)).status, "already_completed");
  assert.equal(fixture.providerCalls(), 0);
  assert.deepEqual(fixture.rpcCalls.map((call) => call.name), [
    "reserve_tailoring_generation_credit_trusted",
    "finalize_tailored_resume_document_trusted",
  ]);
  assert.deepEqual(fixture.rpcCalls[1].parameters.p_version_content, {});
});

test("provider failures and invalid provider output each attempt one refund", async () => {
  const cases: HarnessOptions[] = [
    { providerResult: { status: "refusal" } },
    { providerResult: { status: "unavailable" } },
    { providerThrows: true },
    { providerResult: { status: "invalid_output" } },
  ];
  for (const options of cases) {
    const fixture = harness(options);
    const result = await fixture.coordinator(JOB_ID, KEY_ID);
    assert.ok(result.status === "provider_unavailable" || result.status === "invalid_provider_output");
    assert.equal(fixture.providerCalls(), 1);
    assert.equal(fixture.rpcCalls.filter((call) => call.name === "refund_tailoring_generation_reservation_trusted").length, 1);
  }
});

test("invalid, duplicate, unknown, and incompatible v2 references refund without finalization", async () => {
  const base = validTailoringPlanV2();
  const unsafePlans = [
    { ...base, sections: [{ type: "experience", entries: [{ entryId: "entry_999", fragmentIds: ["fragment_001_001"] }], evidenceIds: [] }] },
    { ...base, sections: [{ type: "experience", entries: [{ entryId: "entry_001", fragmentIds: ["fragment_999"] }], evidenceIds: [] }] },
    { ...base, sections: [{ type: "skills", entries: [], evidenceIds: ["technology_001"] }] },
    { ...base, sections: [{ type: "technologies", entries: [], evidenceIds: ["technology_001", "technology_001"] }] },
  ];
  for (const providerOutput of unsafePlans) {
    const fixture = harness({ providerOutput });
    assert.deepEqual(await fixture.coordinator(JOB_ID, KEY_ID), { status: "invalid_provider_output" });
    assert.equal(fixture.rpcCalls.at(-1)?.name, "refund_tailoring_generation_reservation_trusted");
  }
});

test("document, envelope, and finalization failures refund and never partially finalize", async () => {
  for (const options of [
    { invalidDocument: true },
    { invalidEnvelope: true },
    { finalizationStatus: "invalid_output" },
  ]) {
    const fixture = harness(options);
    const result = await fixture.coordinator(JOB_ID, KEY_ID);
    assert.ok(result.status === "invalid_provider_output" || result.status === "persistence_failed");
    assert.equal(fixture.rpcCalls.at(-1)?.name, "refund_tailoring_generation_reservation_trusted");
  }
});

test("coordinator exposes only job and idempotency IDs and activates no route or UI", () => {
  const source = readFileSync("lib/tailoring/generate-owned-tailored-resume.ts", "utf8");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /generateOwnedTailoredResume\(\s*jobId: string,\s*idempotencyKey: string/);
  assert.doesNotMatch(source, /app\/|components\/|server action|rawProfile|rawJobText/);
  assert.doesNotMatch(source, /console\./);
  const resultContract = source.match(/export type GenerateOwnedTailoredResumeResult =[\s\S]*?export type GenerateOwnedTailoredResumeDependencies/)?.[0];
  assert.ok(resultContract);
  assert.doesNotMatch(resultContract, /fingerprint|provider input|provider output|userId/i);
});
