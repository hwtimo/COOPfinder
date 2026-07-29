import assert from "node:assert/strict";
import test from "node:test";

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
      return { status: "persisted" };
    },
  });
  assert.deepEqual(await run(JOB_ID), {
    status: "analysis_result",
    analysis: { status: "persisted" },
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
        return { status: "persisted" };
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
  for (const status of [
    "no_credits",
    "daily_limit",
    "provider_unavailable",
    "invalid_structured_output",
    "persistence_unavailable",
  ] as const) {
    const run = createFetchAndAnalyzeOwnedJobHandler({
      async fetchAndPersist() {
        return { status: "success" };
      },
      async analyze() {
        return { status };
      },
    });
    assert.deepEqual(await run(JOB_ID), {
      status: "analysis_result",
      analysis: { status },
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
    /supabase|openai|responses\.create|reserve|finalize|refund|job_postings|raw_text|fetch\(/i,
  );
});
