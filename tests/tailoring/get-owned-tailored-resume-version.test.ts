import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import { createGetOwnedTailoredResumeVersionLoader } from "../../lib/tailoring/get-owned-tailored-resume-version";
import { buildTailoredResumeDocument } from "../../lib/tailoring/tailored-resume-document";
import { buildTailoredResumeVersionContent } from "../../lib/tailoring/tailored-resume-version-content";
import { buildTailoringGeneratedContent } from "../../lib/tailoring/tailoring-generated-content";
import {
  immutableTailoringProviderInput,
  TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  tailoringProviderInputV1Schema,
} from "../../lib/tailoring/tailoring-provider-contracts";
import { readyPreflightV2, resumeSourceSnapshotV2, validTailoringPlanV2 } from "./tailoring-v2-fixtures";

const USER_ID = "a71a0000-0000-4000-8000-000000000001";
const VERSION_ID = "b71a0000-0000-4000-8000-000000000001";
const JOB_ID = "c71a0000-0000-4000-8000-000000000001";

function v2Content() {
  const input = buildTailoringProviderInputV2(readyPreflightV2(), resumeSourceSnapshotV2());
  assert.equal(input.status, "success");
  if (input.status !== "success") throw new Error("expected input");
  const plan = validTailoringPlanV2();
  const document = buildTailoredResumeDocument(input.input, plan);
  assert.equal(document.status, "success");
  if (document.status !== "success") throw new Error("expected document");
  const content = buildTailoredResumeVersionContent(input.input, plan, document.document, document.document.sourceFingerprint);
  assert.equal(content.status, "success");
  if (content.status !== "success") throw new Error("expected content");
  return content.content;
}

function v1Content() {
  const input = immutableTailoringProviderInput(tailoringProviderInputV1Schema.parse({
    contractVersion: "tailoring-provider-input-v1",
    job: { title: "Developer", companyName: "Example" },
    approvedCandidateEvidence: [{
      evidenceId: "ev_001",
      category: "technology",
      term: "TypeScript",
      sourceType: "explicit_technology",
    }],
    jobContext: {
      matchedRequirements: [],
      notEvidencedRequirements: [],
      responsibilities: [],
      unassessed: { total: 0, categories: [] },
      workAuthorization: { status: "no_job_requirement", jobRequirements: [], candidateValue: null },
    },
    prohibitedClaimCategories: [...TAILORING_PROHIBITED_CLAIM_CATEGORIES],
  }));
  const result = buildTailoringGeneratedContent(input, {
    contractVersion: "tailoring-plan-output-v1",
    summaryEvidenceIds: ["ev_001"],
    sections: [],
  }, "a".repeat(64));
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("expected v1 content");
  return result.content;
}

type Options = Readonly<{
  user?: Readonly<{ id: string }> | null;
  row?: Readonly<{ id: string; name: string; content: unknown; jobPostingId: string | null }> | null;
  lookupUnavailable?: boolean;
}>;

function harness(options: Options = {}) {
  const calls: string[] = [];
  const loader = createGetOwnedTailoredResumeVersionLoader({
    async getAuthenticatedUser() {
      calls.push("auth");
      return options.user === undefined ? { id: USER_ID } : options.user;
    },
    async getOwnedVersion(input) {
      calls.push(`version:${input.userId}`);
      if (options.lookupUnavailable) return { status: "unavailable" };
      return {
        status: "ready",
        version: options.row === undefined ? {
          id: VERSION_ID,
          name: "Product Developer - tailored v2",
          content: v2Content(),
          jobPostingId: JOB_ID,
        } : options.row,
      };
    },
  });
  return { loader, calls };
}

test("owner loads a v2 complete document as an immutable privacy-safe review", async () => {
  const fixture = harness();
  const result = await fixture.loader(VERSION_ID);
  assert.equal(result.status, "ready");
  if (result.status !== "ready" || !("identity" in result.review)) return;
  assert.equal(result.review.identity.fullName, "Avery Chen");
  const bullets = result.review.sections.flatMap((section) => section.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)));
  assert.deepEqual(bullets, ["Built keyboard-accessible navigation.", "Improved latency by 37% in 2025."]);
  assert.doesNotMatch(JSON.stringify(result.review), /This approved but unselected fragment/);
  assert.deepEqual(fixture.calls, ["auth", `version:${USER_ID}`]);
});

test("existing v1 generated content remains readable", async () => {
  const result = await harness({ row: {
    id: VERSION_ID,
    name: "Developer - tailored v1",
    content: v1Content(),
    jobPostingId: JOB_ID,
  } }).loader(VERSION_ID);
  assert.equal(result.status, "ready");
  if (result.status !== "ready" || !("summaryEvidence" in result.review)) return;
  assert.equal(result.review.summaryEvidence[0].term, "TypeScript");
});

test("foreign, missing, detached-job, and malformed IDs share safe not-found behavior", async () => {
  for (const fixture of [
    harness({ row: null }),
    harness({ row: { id: VERSION_ID, name: "Product Developer - tailored v2", content: v2Content(), jobPostingId: null } }),
  ]) {
    assert.deepEqual(await fixture.loader(VERSION_ID), { status: "not_found" });
  }
  assert.deepEqual(await harness().loader("bad"), { status: "not_found" });
});

test("unauthenticated, unavailable, malformed, and legacy states are safe", async () => {
  assert.deepEqual(await harness({ user: null }).loader(VERSION_ID), { status: "unauthenticated" });
  assert.deepEqual(await harness({ lookupUnavailable: true }).loader(VERSION_ID), { status: "unavailable" });
  const base = { id: VERSION_ID, name: "Developer - tailored v1", jobPostingId: JOB_ID };
  assert.deepEqual(await harness({ row: { ...base, content: { unsafe: true } } }).loader(VERSION_ID), { status: "invalid_content" });
  assert.deepEqual(await harness({ row: { ...base, content: { contractVersion: "tailoring-plan-output-v1", summaryEvidenceIds: [], sections: [] } } }).loader(VERSION_ID), { status: "legacy_content_unavailable" });
});

test("loader is request-bound, RLS-scoped, read-only, and independent of current profile and job", () => {
  const source = readFileSync("lib/tailoring/get-owned-tailored-resume-version.ts", "utf8");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /createSupabaseServerClient/);
  assert.match(source, /getSupabaseUser/);
  assert.match(source, /\.from\("resume_versions"\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.doesNotMatch(source, /createSupabaseAdminClient|service[_-]?role/i);
  assert.doesNotMatch(source, /master_profiles|job_postings|MasterProfile|extracted|raw_text/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(source, /provider|credit|console\./i);
});
