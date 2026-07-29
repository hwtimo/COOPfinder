import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createJobAnalysisRunner,
  jobAnalysisFeedback,
} from "../../lib/ai/job-analysis-control";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

const safeFailures = [
  ["unauthenticated", "not_used", "Log in again to analyze this job."],
  ["job_unavailable", "not_used", "This private job is no longer available."],
  ["invalid_job_id", "not_used", "This private job is no longer available."],
  [
    "unsupported_source",
    "not_used",
    "Analysis is available only for pasted job descriptions.",
  ],
  ["no_credits", "not_used", "You have used your available job analyses."],
  [
    "daily_limit",
    "not_used",
    "You have reached the rolling 24-hour analysis attempt limit. Try again later.",
  ],
  [
    "credit_unavailable",
    "refund_unavailable",
    "Analysis credits are temporarily unavailable. Try again.",
  ],
  ["invalid_job_text", "not_used", "Add a valid job description before analyzing."],
  ["configuration_unavailable", "refunded", "AI analysis is not configured right now."],
  [
    "provider_refusal",
    "refunded",
    "The job description could not be analyzed. Review the text and try again.",
  ],
  [
    "provider_unavailable",
    "refunded",
    "AI analysis is temporarily unavailable. Try again.",
  ],
  [
    "invalid_structured_output",
    "refunded",
    "The analysis response could not be validated. Try again.",
  ],
  ["persistence_unavailable", "refunded", "The analysis could not be saved. Try again."],
  [
    "persistence_rejected",
    "refunded",
    "The analysis could not be saved because it was invalid. Try again.",
  ],
] as const;

test("maps persisted success and requests a refresh", () => {
  assert.deepEqual(jobAnalysisFeedback({ status: "persisted", creditResult: "used" }), {
    tone: "success",
    message: "Analysis saved. Review the extracted details before applying.",
    creditMessage: "One analysis credit was used.",
    refresh: true,
  });
});

test("maps already-persisted success and requests a refresh", () => {
  assert.deepEqual(jobAnalysisFeedback({ status: "already_persisted", creditResult: "used" }), {
    tone: "success",
    message: "The saved analysis is already up to date.",
    creditMessage: "One analysis credit was used.",
    refresh: true,
  });
});

for (const [status, creditResult, message] of safeFailures) {
  test(`maps ${status} to fixed safe UI copy`, () => {
    assert.deepEqual(jobAnalysisFeedback({ status, creditResult }), {
      tone: "error",
      message,
      creditMessage:
        creditResult === "not_used"
          ? "No analysis credit was used."
          : creditResult === "refunded"
            ? "The analysis credit was refunded."
            : "Refund status is unavailable. Do not assume a refund.",
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
      creditMessage: "Refund status is unavailable. Do not assume a refund.",
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
        creditResult: status === "provider_unavailable" ? "refunded" : "refund_unavailable",
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
      return { status: "persisted", creditResult: "used" };
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
  resolveAction({ status: "persisted", creditResult: "used" });
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
      creditMessage: "Refund status is unavailable. Do not assume a refund.",
      refresh: false,
    },
  });
  assert.equal(refreshes, 0);
});

test("pending UI gives truthful ordered progress and the duplicate-credit message", () => {
  const source = readFileSync("components/jobs/job-analysis-control.tsx", "utf8");

  assert.match(source, /Already analyzing — this won’t use another credit\./);
  assert.match(source, /1\. Check the saved job and analysis credit\./);
  assert.match(source, /2\. Analyze and validate the saved job description\./);
  assert.match(source, /3\. Save verified analysis and finalize the credit\./);
  assert.match(source, /disabled=\{pending\}/);
  assert.doesNotMatch(source, /Analyzing job description\.\.\./);
});

test("Analyze Again failures do not refresh away the previous analysis", async () => {
  let refreshes = 0;
  const runner = createJobAnalysisRunner({
    invoke: async () => ({
      status: "provider_unavailable",
      creditResult: "refunded",
    }),
    refresh: () => {
      refreshes += 1;
    },
  });

  const result = await runner.submit(JOB_ID);

  assert.equal(result.status, "completed");
  assert.equal(result.feedback?.refresh, false);
  assert.equal(refreshes, 0);
  const source = readFileSync("components/jobs/job-analysis-control.tsx", "utf8");
  assert.match(source, /hasSavedAnalysis[\s\S]*"Analyze again"/);
});
