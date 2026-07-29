import assert from "node:assert/strict";
import test from "node:test";

import { createFetchAndPersistOwnedJobUrlHandler } from "../../lib/jobs/fetch-and-persist-owned-job-url";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";
const SOURCE_URL = "https://jobs.example.com/role";
const FETCHED_TEXT = "Build reliable software.";

test("successful fetch performs one atomic owner-scoped transition", async () => {
  const calls = { fetch: 0, context: 0, persist: 0 };
  const stored = {
    id: JOB_ID,
    sourceUrl: SOURCE_URL,
    rawText: null as string | null,
    intakeSource: "pasted_url",
    extracted: { version: "existing" },
  };
  const run = createFetchAndPersistOwnedJobUrlHandler({
    async fetchOwnedSource(jobId) {
      calls.fetch += 1;
      assert.equal(jobId, JOB_ID);
      return {
        status: "success",
        sourceUrl: SOURCE_URL,
        text: FETCHED_TEXT,
      };
    },
    async getPersistenceContext() {
      calls.context += 1;
      return {
        status: "ready" as const,
        async persistFetchedText(jobId, sourceUrl, text) {
          calls.persist += 1;
          assert.equal(jobId, JOB_ID);
          assert.equal(sourceUrl, stored.sourceUrl);
          stored.rawText = text;
          stored.intakeSource = "pasted_text";
          return { data: { id: JOB_ID }, error: null };
        },
      };
    },
  });

  assert.deepEqual(await run(JOB_ID), { status: "success" });
  assert.deepEqual(calls, { fetch: 1, context: 1, persist: 1 });
  assert.deepEqual(stored, {
    id: JOB_ID,
    sourceUrl: SOURCE_URL,
    rawText: FETCHED_TEXT,
    intakeSource: "pasted_text",
    extracted: { version: "existing" },
  });
});

test("every typed transport failure returns manual fallback and makes zero writes", async () => {
  const failures = [
    "source_unavailable",
    "blocked_url",
    "redirect",
    "timeout",
    "oversized_body",
    "unsupported_content",
    "http_failure",
    "empty_text",
    "transport_unavailable",
  ] as const;

  for (const status of failures) {
    let writes = 0;
    const run = createFetchAndPersistOwnedJobUrlHandler({
      async fetchOwnedSource() {
        return { status };
      },
      async getPersistenceContext() {
        writes += 1;
        return { status: "unavailable" as const };
      },
    });
    assert.deepEqual(await run(JOB_ID), {
      status: "manual_paste_required",
    });
    assert.equal(writes, 0);
  }
});

test("unauthenticated and foreign-user jobs never reach persistence", async () => {
  for (const status of ["unauthenticated", "job_unavailable"] as const) {
    let persistenceContexts = 0;
    const run = createFetchAndPersistOwnedJobUrlHandler({
      async fetchOwnedSource() {
        return { status };
      },
      async getPersistenceContext() {
        persistenceContexts += 1;
        return { status: "unavailable" as const };
      },
    });
    assert.deepEqual(await run(JOB_ID), { status });
    assert.equal(persistenceContexts, 0);
  }
});

test("invalid IDs do not call transport or persistence", async () => {
  let calls = 0;
  const run = createFetchAndPersistOwnedJobUrlHandler({
    async fetchOwnedSource() {
      calls += 1;
      return { status: "job_unavailable" };
    },
    async getPersistenceContext() {
      calls += 1;
      return { status: "unavailable" };
    },
  });
  assert.deepEqual(await run("not-a-job-id"), {
    status: "job_unavailable",
  });
  assert.equal(calls, 0);
});

test("ownership races and persistence failures cannot report partial success", async () => {
  for (const response of [
    { data: null, error: null },
    { data: null, error: { code: "PRIVATE_DATABASE_DETAIL" } },
  ]) {
    const run = createFetchAndPersistOwnedJobUrlHandler({
      async fetchOwnedSource() {
        return {
          status: "success",
          sourceUrl: SOURCE_URL,
          text: FETCHED_TEXT,
        };
      },
      async getPersistenceContext() {
        return {
          status: "ready" as const,
          async persistFetchedText() {
            return response;
          },
        };
      },
    });
    assert.deepEqual(await run(JOB_ID), {
      status: response.error
        ? "persistence_unavailable"
        : "job_unavailable",
    });
  }
});

test("production boundary preserves source and extraction while updating text and intake atomically", async () => {
  const fs = await import("node:fs/promises");
  const transition = await fs.readFile(
    new URL(
      "../../lib/jobs/manual-job-description-transition.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const orchestrator = await fs.readFile(
    new URL(
      "../../lib/jobs/fetch-and-persist-owned-job-url.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = await fs.readFile(
    new URL("../../app/(app)/jobs/actions.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    transition,
    /\.update\(\{ raw_text: rawText, intake_source: "pasted_text" \}\)/,
  );
  assert.match(transition, /\.eq\("user_id", userId\)/);
  assert.match(transition, /\.eq\("intake_source", "pasted_url"\)/);
  assert.match(transition, /\.eq\("source_url", expectedSourceUrl\)/);
  assert.doesNotMatch(
    transition,
    /extracted\s*:|source_url\s*:|board_jobs|insert\(|upsert\(/,
  );
  assert.match(orchestrator, /^import "server-only";/);
  assert.match(actions, /export async function fetchSavedJobUrlAction/);
  assert.doesNotMatch(
    orchestrator,
    /openai|provider|credit|reservation|analy[sz]e|board_jobs/i,
  );
});
