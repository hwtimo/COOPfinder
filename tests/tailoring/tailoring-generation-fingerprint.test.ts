import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeTailoringProviderInput,
  fingerprintTailoringProviderInput,
} from "../../lib/tailoring/tailoring-generation-fingerprint";
import {
  immutableTailoringProviderInput,
  TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  tailoringProviderInputV1Schema,
  type TailoringProviderInputV1,
} from "../../lib/tailoring/tailoring-provider-contracts";

function input(): TailoringProviderInputV1 {
  return immutableTailoringProviderInput(
    tailoringProviderInputV1Schema.parse({
    contractVersion: "tailoring-provider-input-v1",
    job: { title: "Developer", companyName: "Example" },
    approvedCandidateEvidence: [
      {
        evidenceId: "ev_001",
        category: "technology",
        term: "TypeScript",
        sourceType: "explicit_technology",
        sourceLabel: "Technologies",
      },
    ],
    jobContext: {
      matchedRequirements: [
        {
          category: "required_technology",
          modality: "required",
          requirement: "TypeScript",
          evidenceId: "ev_001",
        },
      ],
      notEvidencedRequirements: [],
      responsibilities: [],
      unassessed: { total: 0, categories: [] },
      workAuthorization: {
        status: "no_job_requirement",
        jobRequirements: [],
        candidateValue: null,
      },
    },
      prohibitedClaimCategories: [...TAILORING_PROHIBITED_CLAIM_CATEGORIES],
    }),
  );
}

test("canonical serialization and fingerprint are deterministic", () => {
  const value = input();
  const before = structuredClone(value);
  assert.equal(
    canonicalizeTailoringProviderInput(value),
    canonicalizeTailoringProviderInput(value),
  );
  assert.match(fingerprintTailoringProviderInput(value), /^[0-9a-f]{64}$/);
  assert.equal(
    fingerprintTailoringProviderInput(value),
    fingerprintTailoringProviderInput(structuredClone(value)),
  );
  assert.deepEqual(value, before);
});

test("object-key insertion order does not affect canonical serialization", () => {
  const value = input();
  const reordered = {
    prohibitedClaimCategories: value.prohibitedClaimCategories,
    jobContext: value.jobContext,
    approvedCandidateEvidence: value.approvedCandidateEvidence,
    job: value.job,
    contractVersion: value.contractVersion,
  } as TailoringProviderInputV1;
  assert.equal(
    canonicalizeTailoringProviderInput(value),
    canonicalizeTailoringProviderInput(reordered),
  );
});

test("contract version is present and evidence or context changes the fingerprint", () => {
  const value = input();
  assert.match(
    canonicalizeTailoringProviderInput(value),
    /"contractVersion":"tailoring-provider-input-v1"/,
  );
  const evidenceChanged: TailoringProviderInputV1 = {
    ...value,
    approvedCandidateEvidence: [
      { ...value.approvedCandidateEvidence[0], term: "React" },
    ],
  };
  const contextChanged: TailoringProviderInputV1 = {
    ...value,
    jobContext: {
      ...value.jobContext,
      responsibilities: [
        { contextId: "ctx_001", responsibility: "Build interfaces" },
      ],
    },
  };
  assert.notEqual(
    fingerprintTailoringProviderInput(value),
    fingerprintTailoringProviderInput(evidenceChanged),
  );
  assert.notEqual(
    fingerprintTailoringProviderInput(value),
    fingerprintTailoringProviderInput(contextChanged),
  );
});

test("unsafe surrounding data is rejected rather than entering the hash", () => {
  const unsafe = { ...input(), rawProfile: "private prose" };
  assert.throws(() =>
    fingerprintTailoringProviderInput(
      unsafe as unknown as TailoringProviderInputV1,
    ),
  );
});
