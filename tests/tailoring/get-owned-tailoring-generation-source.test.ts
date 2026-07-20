import assert from "node:assert/strict";
import test from "node:test";

import { createOwnedTailoringGenerationSourceCoordinator } from "../../lib/tailoring/get-owned-tailoring-generation-source";
import { buildResumeSourceSnapshot } from "../../lib/tailoring/resume-source-snapshot";
import { buildTailoringPreflight } from "../../lib/tailoring/tailoring-preflight";
import type { OwnedJobMatchContextResult } from "../../lib/matching/get-owned-job-match";
import { readyPreflightV2, resumeSourceSnapshotV2 } from "./tailoring-v2-fixtures";

function matchedContext(): Extract<OwnedJobMatchContextResult, { status: "matched" }> {
  return {
    status: "matched",
    job: { id: "00000000-0000-4000-8000-000000000099", extracted: {}, title: "Product Developer", companyName: "Example Company", location: "Vancouver, BC" },
    profile: {} as never,
    canonicalRequirements: {} as never,
    match: {} as never,
  };
}

test("rebuilds ready preflight and approved snapshot from one owner-scoped context", async () => {
  let contextCalls = 0;
  const coordinator = createOwnedTailoringGenerationSourceCoordinator({
    async getOwnedMatchContext() { contextCalls += 1; return matchedContext(); },
    buildPreflight: () => readyPreflightV2(),
    buildSnapshot: () => ({ status: "ready", snapshot: resumeSourceSnapshotV2() }),
  });
  const result = await coordinator("job-id");
  assert.equal(result.status, "ready");
  assert.equal(contextCalls, 1);
});

test("requires at least one approved fragment and maps invalid snapshots safely", async () => {
  const base = resumeSourceSnapshotV2();
  const noFragments = createOwnedTailoringGenerationSourceCoordinator({
    async getOwnedMatchContext() { return matchedContext(); },
    buildPreflight: () => readyPreflightV2(),
    buildSnapshot: () => ({ status: "ready", snapshot: { ...base, entries: [] } }),
  });
  assert.deepEqual(await noFragments("job-id"), { status: "insufficient_candidate_data" });

  const invalid = createOwnedTailoringGenerationSourceCoordinator({
    async getOwnedMatchContext() { return matchedContext(); },
    buildPreflight: () => readyPreflightV2(),
    buildSnapshot: () => ({ status: "invalid_profile" }),
  });
  assert.deepEqual(await invalid("job-id"), { status: "profile_unavailable" });
});

test("propagates owner, extraction, profile, and readiness failures before generation", async () => {
  for (const status of ["unauthenticated", "not_found", "extraction_unavailable", "profile_unavailable", "invalid_extraction", "unavailable"] as const) {
    const coordinator = createOwnedTailoringGenerationSourceCoordinator({
      async getOwnedMatchContext() { return { status }; },
      buildPreflight: buildTailoringPreflight,
      buildSnapshot: buildResumeSourceSnapshot,
    });
    assert.deepEqual(await coordinator("job-id"), { status });
  }
});
