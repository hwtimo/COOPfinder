import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getPreferredOwnedResumeVersionForJob,
  selectPreferredApplicationResumeVersion,
  type ApplicationResumeVersionCandidate,
} from "../../lib/applications/select-resume-version-for-job";
import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import { buildTailoredResumeDocument } from "../../lib/tailoring/tailored-resume-document";
import { buildTailoredResumeVersionContent } from "../../lib/tailoring/tailored-resume-version-content";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "../tailoring/tailoring-v2-fixtures";

const JOB_ID = "c71a0000-0000-4000-8000-000000000001";
const OTHER_JOB_ID = "c71a0000-0000-4000-8000-000000000002";
const PARENT_ID = "b71a0000-0000-4000-8000-000000000001";
const CHILD_ID = "b71a0000-0000-4000-8000-000000000002";

function generatedContent() {
  const input = buildTailoringProviderInputV2(
    readyPreflightV2(),
    resumeSourceSnapshotV2(),
  );
  assert.equal(input.status, "success");
  if (input.status !== "success") throw new Error("expected provider input");
  const document = buildTailoredResumeDocument(
    input.input,
    validTailoringPlanV2(),
  );
  assert.equal(document.status, "success");
  if (document.status !== "success") throw new Error("expected document");
  const content = buildTailoredResumeVersionContent(
    input.input,
    validTailoringPlanV2(),
    document.document,
    document.document.sourceFingerprint,
  );
  assert.equal(content.status, "success");
  if (content.status !== "success") throw new Error("expected version content");
  return content.content;
}

function candidate(
  overrides: Partial<ApplicationResumeVersionCandidate> = {},
): ApplicationResumeVersionCandidate {
  return {
    id: PARENT_ID,
    jobPostingId: JOB_ID,
    authorship: "ai_generated",
    parentVersionId: null,
    content: generatedContent(),
    createdAt: "2026-07-29T18:00:00.000Z",
    ...overrides,
  };
}

function editedCandidate(
  overrides: Partial<ApplicationResumeVersionCandidate> = {},
): ApplicationResumeVersionCandidate {
  const parent = generatedContent();
  return candidate({
    id: CHILD_ID,
    authorship: "user_authored",
    parentVersionId: PARENT_ID,
    content: {
      contractVersion: "user-edited-tailored-resume-content-v1",
      authorship: "user",
      parentVersionId: PARENT_ID,
      document: parent.document,
    },
    ...overrides,
  });
}

test("selects the newest valid edited child over its generated parent", () => {
  assert.equal(
    selectPreferredApplicationResumeVersion(JOB_ID, [
      candidate(),
      editedCandidate({ createdAt: "2026-07-29T19:00:00.000Z" }),
    ]),
    CHILD_ID,
  );
});

test("prefers a valid edited child when eligible versions share a timestamp", () => {
  assert.equal(
    selectPreferredApplicationResumeVersion(JOB_ID, [
      candidate(),
      editedCandidate(),
    ]),
    CHILD_ID,
  );
});

test("selects a generated version when no eligible edited child exists", () => {
  assert.equal(
    selectPreferredApplicationResumeVersion(JOB_ID, [candidate()]),
    PARENT_ID,
  );
});

test("returns no version when none is eligible", () => {
  assert.equal(
    selectPreferredApplicationResumeVersion(JOB_ID, [
      candidate({ jobPostingId: OTHER_JOB_ID }),
      editedCandidate({
        parentVersionId: "b71a0000-0000-4000-8000-000000000099",
        content: {
          contractVersion: "user-edited-tailored-resume-content-v1",
          authorship: "user",
          parentVersionId: "b71a0000-0000-4000-8000-000000000099",
          document: generatedContent().document,
        },
      }),
      candidate({
        id: "b71a0000-0000-4000-8000-000000000003",
        content: { malformed: true },
      }),
    ]),
    null,
  );
});

test("ignores foreign and mismatched versions even when they are newer", () => {
  assert.equal(
    selectPreferredApplicationResumeVersion(JOB_ID, [
      candidate(),
      candidate({
        id: "b71a0000-0000-4000-8000-000000000003",
        jobPostingId: OTHER_JOB_ID,
        createdAt: "2026-07-30T18:00:00.000Z",
      }),
    ]),
    PARENT_ID,
  );
});

test("loads eligible versions once with explicit owner and job scoping", async () => {
  const calls: string[] = [];
  const query = {
    from(table: string) {
      calls.push(`from:${table}`);
      return this;
    },
    select(columns: string) {
      calls.push(`select:${columns}`);
      return this;
    },
    eq(column: string, value: string) {
      calls.push(`eq:${column}:${value}`);
      return this;
    },
    order(column: string) {
      calls.push(`order:${column}`);
      if (column === "id") {
        return Promise.resolve({
          data: [
            {
              id: PARENT_ID,
              job_posting_id: JOB_ID,
              authorship: "ai_generated",
              parent_version_id: null,
              content: generatedContent(),
              created_at: "2026-07-29T18:00:00.000Z",
            },
          ],
          error: null,
        });
      }
      return this;
    },
  };
  const result = await getPreferredOwnedResumeVersionForJob(
    query as unknown as SupabaseClient,
    "a71a0000-0000-4000-8000-000000000001",
    JOB_ID,
  );

  assert.deepEqual(result, {
    status: "ready",
    resumeVersionId: PARENT_ID,
  });
  assert.equal(calls.filter((call) => call.startsWith("from:")).length, 1);
  assert.ok(
    calls.includes(
      "eq:user_id:a71a0000-0000-4000-8000-000000000001",
    ),
  );
  assert.ok(calls.includes(`eq:job_posting_id:${JOB_ID}`));
});

test("Job Detail uses the scoped selector and existing atomic creation path", () => {
  const selector = readFileSync(
    "lib/applications/select-resume-version-for-job.ts",
    "utf8",
  );
  const action = readFileSync("app/(app)/applications/actions.ts", "utf8");
  const control = readFileSync(
    "components/jobs/application-tracking-control.tsx",
    "utf8",
  );
  const jobPage = readFileSync("app/(app)/jobs/[id]/page.tsx", "utf8");

  assert.match(selector, /\.eq\("user_id", userId\)/);
  assert.match(selector, /\.eq\("job_posting_id", jobId\)/);
  assert.match(action, /getPreferredOwnedResumeVersionForJob\(/);
  assert.match(action, /createApplicationFromJob\(/);
  assert.match(control, /if \(submittingRef\.current\) return/);
  assert.match(control, /disabled=\{pending\}/);
  assert.match(jobPage, /linkPreferredResumeVersion/);
  assert.doesNotMatch(
    selector,
    /openai|provider|credit|reservation|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/i,
  );
});
