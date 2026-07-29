import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createJobUrlFetchAnalysisRunner,
  jobUrlFetchAnalysisFeedback,
} from "../../lib/jobs/job-url-fetch-analysis-control";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

test("renders one primary Fetch and analyze action and no credit claim on failure", () => {
  const source = readFileSync(
    "components/jobs/job-url-fetch-analysis-control.tsx",
    "utf8",
  );
  assert.match(source, /"Fetch and analyze"/);
  assert.match(source, /Failed[\s\S]*retrievals use no parser credit/);
  assert.equal((source.match(/<Button/g) ?? []).length, 2);
  assert.equal((source.match(/variant="outline"/g) ?? []).length, 1);
});

test("maps each transport failure to fixed manual-paste copy with no parser credit", () => {
  const expected = {
    blocked_url: /cannot be fetched safely/,
    redirect: /redirects.*not followed/,
    timeout: /too long to respond/,
    oversized_body: /too large/,
    unsupported_content: /not supported HTML or plain text/,
    http_failure: /could not be retrieved/,
    empty_text: /did not contain readable job text/,
  } as const;
  for (const [reason, pattern] of Object.entries(expected)) {
    const feedback = jobUrlFetchAnalysisFeedback({
      status: "manual_paste_required",
      reason,
    });
    assert.equal(feedback.fetched, false);
    assert.equal(feedback.refresh, false);
    assert.match(feedback.message, pattern);
    assert.match(feedback.message, /Paste the job description instead/);
    assert.match(feedback.message, /No parser credit was used/);
  }
});

test("credit and analysis failures reuse existing safe feedback after fetch persistence", () => {
  assert.deepEqual(
    jobUrlFetchAnalysisFeedback({
      status: "analysis_result",
      analysis: { status: "no_credits", creditResult: "not_used" },
    }),
    {
      tone: "error",
      message:
        "The job description was fetched and saved. You have used your available job analyses. No analysis credit was used.",
      fetched: true,
      refresh: false,
    },
  );
  const providerFailure = jobUrlFetchAnalysisFeedback({
    status: "analysis_result",
    analysis: { status: "provider_unavailable", creditResult: "refunded" },
  });
  assert.match(providerFailure.message, /fetched and saved/);
  assert.match(providerFailure.message, /temporarily unavailable/);
  assert.equal(providerFailure.fetched, true);
});

test("unknown action and fetch outputs fail closed without internal details", () => {
  const marker = "PRIVATE_INTERNAL_FETCH_DETAIL";
  const feedback = jobUrlFetchAnalysisFeedback({
    status: "manual_paste_required",
    reason: "future_reason",
    detail: marker,
  });
  assert.match(feedback.message, /could not be prepared/);
  assert.equal(feedback.message.includes(marker), false);
});

test("runner ignores an in-flight duplicate and invokes the combined action once", async () => {
  let resolveAction: ((value: unknown) => void) | undefined;
  let calls = 0;
  const runner = createJobUrlFetchAnalysisRunner({
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
  resolveAction({
    status: "manual_paste_required",
    reason: "timeout",
  });
  await first;
  assert.equal(runner.isPending(), false);
});

test("runner refreshes only after successful analysis", async () => {
  let refreshes = 0;
  const runner = createJobUrlFetchAnalysisRunner({
    async invoke() {
      return {
        status: "analysis_result",
        analysis: { status: "persisted", creditResult: "used" },
      };
    },
    refresh() {
      refreshes += 1;
    },
  });
  const result = await runner.submit(JOB_ID);
  assert.equal(result.status, "completed");
  assert.equal(refreshes, 1);
});

test("Job Detail wires the URL-only control without changing the existing Analyze path", () => {
  const page = readFileSync("app/(app)/jobs/[id]/page.tsx", "utf8");
  const actions = readFileSync("app/(app)/jobs/actions.ts", "utf8");
  assert.match(page, /<JobUrlFetchAnalysisControl jobId=\{job\.id\}/);
  assert.match(page, /<ManualJobDescriptionForm/);
  assert.match(page, /<JobAnalysisControl/);
  assert.match(
    actions,
    /fetchAndPersist: fetchAndPersistOwnedJobUrl[\s\S]*analyze: handlePrivateJobExtraction/,
  );
});
