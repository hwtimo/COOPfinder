import assert from "node:assert/strict";
import test from "node:test";

import {
  createJobAnalysisRunner,
  jobAnalysisFeedback,
} from "../../lib/ai/job-analysis-control";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

const safeFailures = [
  ["unauthenticated", "Log in again to analyze this job."],
  ["job_unavailable", "This private job is no longer available."],
  ["invalid_job_id", "This private job is no longer available."],
  [
    "unsupported_source",
    "Analysis is available only for pasted job descriptions.",
  ],
  ["invalid_job_text", "Add a valid job description before analyzing."],
  ["configuration_unavailable", "AI analysis is not configured right now."],
  [
    "provider_refusal",
    "The job description could not be analyzed. Review the text and try again.",
  ],
  [
    "provider_unavailable",
    "AI analysis is temporarily unavailable. Try again.",
  ],
  [
    "invalid_structured_output",
    "The analysis response could not be validated. Try again.",
  ],
  ["persistence_unavailable", "The analysis could not be saved. Try again."],
  [
    "persistence_rejected",
    "The analysis could not be saved because it was invalid. Try again.",
  ],
] as const;

test("maps persisted success and requests a refresh", () => {
  assert.deepEqual(jobAnalysisFeedback({ status: "persisted" }), {
    tone: "success",
    message: "Analysis saved. Review the extracted details before applying.",
    refresh: true,
  });
});

test("maps already-persisted success and requests a refresh", () => {
  assert.deepEqual(jobAnalysisFeedback({ status: "already_persisted" }), {
    tone: "success",
    message: "The saved analysis is already up to date.",
    refresh: true,
  });
});

for (const [status, message] of safeFailures) {
  test(`maps ${status} to fixed safe UI copy`, () => {
    assert.deepEqual(jobAnalysisFeedback({ status }), {
      tone: "error",
      message,
      refresh: false,
    });
  });
}

test("unknown action output fails closed", () => {
  assert.deepEqual(
    jobAnalysisFeedback({ status: "future_status", detail: "PRIVATE_DETAIL" }),
    {
      tone: "error",
      message: "The analysis could not be completed. Try again.",
      refresh: false,
    },
  );
});

test("UI feedback contains no sensitive action details", () => {
  const markers = [
    "PRIVATE_RAW_JD",
    "PRIVATE_PROVIDER_PAYLOAD",
    "PRIVATE_MODEL_ID",
    "PRIVATE_CREDENTIAL",
    "PRIVATE_DATABASE_ERROR",
    "PRIVATE_STACK_TRACE",
  ];

  for (const status of ["provider_unavailable", "future_status"]) {
    const serialized = JSON.stringify(
      jobAnalysisFeedback({
        status,
        rawText: markers[0],
        provider: markers[1],
        model: markers[2],
        credential: markers[3],
        databaseError: markers[4],
        stack: markers[5],
      }),
    );

    for (const marker of markers) {
      assert.equal(serialized.includes(marker), false);
    }
  }
});

test("runner passes only the current job ID and refreshes after success", async () => {
  const calls: unknown[][] = [];
  let refreshes = 0;
  const runner = createJobAnalysisRunner({
    invoke: async (...args: unknown[]) => {
      calls.push(args);
      return { status: "persisted" };
    },
    refresh: () => {
      refreshes += 1;
    },
  });

  const result = await runner.submit(JOB_ID);

  assert.equal(result.status, "completed");
  assert.deepEqual(calls, [[JOB_ID]]);
  assert.equal(refreshes, 1);
});

test("pending runner ignores a duplicate submission", async () => {
  let resolveAction: ((value: unknown) => void) | undefined;
  let calls = 0;
  const runner = createJobAnalysisRunner({
    invoke: async () => {
      calls += 1;
      return new Promise((resolve) => {
        resolveAction = resolve;
      });
    },
    refresh: () => undefined,
  });

  const first = runner.submit(JOB_ID);
  assert.equal(runner.isPending(), true);
  assert.deepEqual(await runner.submit(JOB_ID), {
    status: "duplicate_ignored",
  });
  assert.equal(calls, 1);

  assert.ok(resolveAction);
  resolveAction({ status: "persisted" });
  await first;
  assert.equal(runner.isPending(), false);
});

test("runner contains thrown action failures without refreshing", async () => {
  let refreshes = 0;
  const runner = createJobAnalysisRunner({
    invoke: async () => {
      throw new Error("PRIVATE_PROVIDER_STACK");
    },
    refresh: () => {
      refreshes += 1;
    },
  });

  const result = await runner.submit(JOB_ID);

  assert.deepEqual(result, {
    status: "completed",
    feedback: {
      tone: "error",
      message: "The analysis could not be completed. Try again.",
      refresh: false,
    },
  });
  assert.equal(refreshes, 0);
});
