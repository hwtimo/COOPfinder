import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOwnedResumeVersionSummaries } from "../../lib/resumes/resume-version-summaries";

const page = readFileSync("app/(app)/resumes/page.tsx", "utf8");
const upload = readFileSync(
  "components/resumes/resume-pdf-upload.tsx",
  "utf8",
);
const uploadAction = readFileSync("app/(app)/resumes/actions.ts", "utf8");
const query = readFileSync(
  "lib/resumes/get-owned-resume-version-summaries.ts",
  "utf8",
);
const productionSources = [page, query].join("\n");

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const JOB_ID = "22222222-2222-4222-8222-222222222222";

test("saved resume summaries preserve real rows with safe display labels", () => {
  const result = parseOwnedResumeVersionSummaries([
    {
      id: VERSION_ID,
      name: "Frontend tailored resume",
      job_posting_id: JOB_ID,
      created_at: "2026-07-25T18:00:00.000Z",
      job: [{ title: "  Frontend   Developer Intern " }],
    },
  ]);

  assert.deepEqual(result, {
    status: "ready",
    versions: [
      {
        id: VERSION_ID,
        name: "Frontend tailored resume",
        jobTitle: "Frontend Developer Intern",
        createdAt: "2026-07-25T18:00:00.000Z",
      },
    ],
  });
});

test("unlinked rows do not become broken production review links", () => {
  const result = parseOwnedResumeVersionSummaries([
    {
      id: VERSION_ID,
      name: "Saved resume",
      job_posting_id: null,
      created_at: "2026-07-25T18:00:00.000Z",
      job: null,
    },
  ]);

  assert.deepEqual(result, { status: "ready", versions: [] });
});

test("malformed persisted display fields fail closed without mock fallback", () => {
  const result = parseOwnedResumeVersionSummaries([
    {
      id: "not-a-version-id",
      name: "Saved resume",
      job_posting_id: JOB_ID,
      created_at: "not-a-date",
      job: { title: "Frontend Intern" },
    },
  ]);

  assert.deepEqual(result, { status: "unavailable", versions: [] });
});

test("non-canonical version names do not produce links rejected by the review route", () => {
  const result = parseOwnedResumeVersionSummaries([
    {
      id: VERSION_ID,
      name: "  Saved resume  ",
      job_posting_id: JOB_ID,
      created_at: "2026-07-25T18:00:00.000Z",
      job: { title: "Frontend Intern" },
    },
  ]);

  assert.deepEqual(result, { status: "unavailable", versions: [] });
});

test("hub query is server-only, owner-scoped, read-only, and display-minimal", () => {
  assert.match(query, /import "server-only"/);
  assert.match(query, /\.from\("resume_versions"\)/);
  assert.match(query, /\.eq\("user_id", userId\)/);
  assert.match(
    query,
    /id,name,job_posting_id,created_at,job:job_postings!resume_versions_job_posting_id_fkey\(title\)/,
  );
  assert.doesNotMatch(
    query,
    /content|keyword_report|notes|focus|base_version_name|insert\(|update\(|upsert\(|delete\(/,
  );
});

test("Resumes hub keeps real entry points and enables bounded PDF extraction", () => {
  assert.match(page, /href="\/resumes\/master"/);
  assert.match(page, />\s*Master Profile\s*</);
  assert.match(page, />\s*Upload resume\s*</);
  assert.match(page, /href="#resume-upload"/);
  assert.match(page, /<ResumePdfUpload \/>/);
  assert.match(upload, /accept="\.pdf,application\/pdf"/);
  assert.match(upload, /PDF only, up to 5 MB and 25 pages/);
  assert.match(upload, /Scanned or image-only PDFs/);
  assert.doesNotMatch(page, /Resume upload is not implemented yet/);
});

test("PDF success is explicit and extends into an unpersisted review draft", () => {
  assert.match(upload, /Text extracted/);
  assert.match(upload, /state\.text/);
  assert.match(upload, /readOnly/);
  assert.match(uploadAction, /This PDF and its text have not been saved/);
  assert.match(upload, /<ResumeProfileDraftPreview draft=\{state\.draft\.value\}/);
  assert.match(uploadAction, /generateResumeProfileDraft\(result\.text\)/);
  assert.doesNotMatch(upload, /saveMasterProfile|confirmed:\s*true/);
});

test("Resumes hub has explicit unavailable and persisted empty states", () => {
  assert.match(page, /if \(!getSupabaseEnv\(\)\)/);
  assert.match(page, /result\.status === "unavailable"/);
  assert.match(page, /No fallback data is shown\./);
  assert.match(page, /title="No saved resume versions yet"/);
  assert.match(page, /actionLabel="Open Master Profile"/);
  assert.match(page, /result\.versions\.map\(\(version\)/);
  assert.match(page, /href=\{`\/resumes\/versions\/\$\{version\.id\}`\}/);
});

test("Resumes hub production code contains no mock fixtures or fabricated performance", () => {
  assert.doesNotMatch(productionSources, /lib\/mock/);
  assert.doesNotMatch(productionSources, /mock[A-Z]|Maya Chen/i);
  assert.doesNotMatch(
    productionSources,
    /Estimated callback rate|Most used version|performance|recent activity|application rate/i,
  );
  assert.doesNotMatch(page, /mock build/i);
});
