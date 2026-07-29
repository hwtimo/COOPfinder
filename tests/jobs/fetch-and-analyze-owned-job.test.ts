import assert from "node:assert/strict";
import test from "node:test";

import type { PrivateJobExtractionActionResult } from "../../lib/ai/job-extraction-action-handler";
import { createFetchAndAnalyzeOwnedJobHandler } from "../../lib/jobs/fetch-and-analyze-owned-job";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

test("successful preparation invokes existing Analyze exactly once", async () => {
  const calls = { fetch: 0, analyze: 0 };
  const run = createFetchAndAnalyzeOwnedJobHandler({
    async fetchAndPersist(jobId) {
      calls.fetch += 1;
      assert.equal(jobId, JOB_ID);
      return { status: "success" };
    },
    async analyze(jobId) {
      calls.analyze += 1;
      assert.equal(jobId, JOB_ID);
      return { status: "persisted", creditResult: "used" };
    },
  });
  assert.deepEqual(await run(JOB_ID), {
    status: "analysis_result",
    analysis: { status: "persisted", creditResult: "used" },
  });
  assert.deepEqual(calls, { fetch: 1, analyze: 1 });
});

test("every fetch failure skips Analyze, provider, and credit paths", async () => {
  const reasons = [
    "blocked_url",
    "redirect",
    "timeout",
    "unsupported_content",
    "http_failure",
    "empty_text",
  ] as const;
  for (const reason of reasons) {
    const calls = { analyze: 0, provider: 0, credit: 0 };
    const run = createFetchAndAnalyzeOwnedJobHandler({
      async fetchAndPersist() {
        return { status: "manual_paste_required", reason };
      },
      async analyze() {
        calls.analyze += 1;
        calls.provider += 1;
        calls.credit += 1;
        return { status: "persisted", creditResult: "used" };
      },
    });
    assert.deepEqual(await run(JOB_ID), {
      status: "manual_paste_required",
      reason,
    });
    assert.deepEqual(calls, { analyze: 0, provider: 0, credit: 0 });
  }
});

test("analysis failures are returned unchanged after fetched text persistence", async () => {
  const failures = [
    { status: "no_credits", creditResult: "not_used" },
    { status: "daily_limit", creditResult: "not_used" },
    { status: "provider_unavailable", creditResult: "refunded" },
    { status: "invalid_structured_output", creditResult: "refunded" },
    { status: "persistence_unavailable", creditResult: "refunded" },
  ] satisfies PrivateJobExtractionActionResult[];
  for (const failure of failures) {
    const run = createFetchAndAnalyzeOwnedJobHandler({
      async fetchAndPersist() {
        return { status: "success" };
      },
      async analyze() {
        return failure;
      },
    });
    assert.deepEqual(await run(JOB_ID), {
      status: "analysis_result",
      analysis: failure,
    });
  }
});

test("orchestrator reuses boundaries without provider, credit, persistence, or fetch implementation", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(
      new URL("../../lib/jobs/fetch-and-analyze-owned-job.ts", import.meta.url),
      "utf8",
    ),
  );
  assert.match(source, /^import "server-only";/);
  assert.doesNotMatch(
    source,
    /supabase|openai|responses\.create|reserve_parser|finalize_parser|refund_parser|job_postings|raw_text|fetch\(/i,
  );
});
