import assert from "node:assert/strict";
import test from "node:test";

import { createManualJobDescriptionTransitionHandler } from "../../lib/jobs/manual-job-description-transition";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

test("owner transition writes only normalized text and returns success", async () => {
  const calls: unknown[][] = [];
  const transition = createManualJobDescriptionTransitionHandler({
    getRequestContext: async () => ({
      status: "ready" as const,
      async updateOwnedPastedUrlJob(...args: [string, string]) {
        calls.push(args);
        return { data: { id: JOB_ID }, error: null };
      },
    }),
  });

  assert.deepEqual(await transition(JOB_ID, "  Complete manual JD  "), {
    status: "success",
  });
  assert.deepEqual(calls, [[JOB_ID, "Complete manual JD"]]);
});

test("foreign or missing jobs return the same safe unavailable result", async () => {
  let updates = 0;
  const transition = createManualJobDescriptionTransitionHandler({
    getRequestContext: async () => ({
      status: "ready" as const,
      async updateOwnedPastedUrlJob() {
        updates += 1;
        return { data: null, error: null };
      },
    }),
  });

  assert.deepEqual(await transition(JOB_ID, "Manual JD"), {
    status: "job_unavailable",
  });
  assert.equal(updates, 1);
});

test("unauthenticated requests never attempt an update", async () => {
  const transition = createManualJobDescriptionTransitionHandler({
    getRequestContext: async () => ({ status: "unauthenticated" as const }),
  });

  assert.deepEqual(await transition(JOB_ID, "Manual JD"), {
    status: "unauthenticated",
  });
});

for (const rawText of ["", "   ", "x".repeat(100_001), null]) {
  test("invalid manual text is rejected before authentication or persistence", async () => {
    let contextCalls = 0;
    const transition = createManualJobDescriptionTransitionHandler({
      getRequestContext: async () => {
        contextCalls += 1;
        return { status: "unavailable" as const };
      },
    });

    assert.deepEqual(await transition(JOB_ID, rawText), {
      status: "invalid_job_text",
    });
    assert.equal(contextCalls, 0);
  });
}

test("failed persistence returns safe output and cannot report a partial success", async () => {
  const previous = {
    sourceUrl: "https://jobs.example.ca/role",
    intakeSource: "pasted_url",
    rawText: null,
    extracted: { contractVersion: "existing" },
  };
  const stored = structuredClone(previous);
  const transition = createManualJobDescriptionTransitionHandler({
    getRequestContext: async () => ({
      status: "ready" as const,
      async updateOwnedPastedUrlJob() {
        return { data: null, error: { code: "PRIVATE_DATABASE_DETAIL" } };
      },
    }),
  });

  assert.deepEqual(await transition(JOB_ID, "Manual JD"), {
    status: "persistence_unavailable",
  });
  assert.deepEqual(stored, previous);
});

test("transition contract has no provider, credit, finalization, extraction, event, or tailoring dependency", async () => {
  const calls = {
    update: 0,
    provider: 0,
    reserve: 0,
    finalize: 0,
    extractionPersistence: 0,
    intakeEvent: 0,
    tailoringCredit: 0,
  };
  const transition = createManualJobDescriptionTransitionHandler({
    getRequestContext: async () => ({
      status: "ready" as const,
      async updateOwnedPastedUrlJob() {
        calls.update += 1;
        return { data: { id: JOB_ID }, error: null };
      },
    }),
  });

  assert.deepEqual(await transition(JOB_ID, "Manual JD"), {
    status: "success",
  });
  assert.deepEqual(calls, {
    update: 1,
    provider: 0,
    reserve: 0,
    finalize: 0,
    extractionPersistence: 0,
    intakeEvent: 0,
    tailoringCredit: 0,
  });
});

test("unexpected internal response data is not exposed", async () => {
  const marker = "PRIVATE_INTERNAL_MARKER";
  const transition = createManualJobDescriptionTransitionHandler({
    getRequestContext: async () => ({
      status: "ready" as const,
      async updateOwnedPastedUrlJob() {
        return { data: { detail: marker }, error: null };
      },
    }),
  });

  const result = await transition(JOB_ID, "Manual JD");
  assert.deepEqual(result, { status: "job_unavailable" });
  assert.equal(JSON.stringify(result).includes(marker), false);
});
