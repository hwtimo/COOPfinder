import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { JobMatchList } from "../../components/jobs/job-match-list";
import {
  sortOwnedJobMatchSummaries,
  type OwnedJobMatchSummary,
} from "../../lib/matching/job-match-summary";

function summary(
  jobId: string,
  overrides: Partial<OwnedJobMatchSummary> = {},
): OwnedJobMatchSummary {
  return {
    jobId,
    title: `Job ${jobId}`,
    companyName: "Example",
    location: "Vancouver, BC",
    updatedAt: "2026-07-20T10:00:00.000Z",
    status: "comparable",
    required: { evidenced: 1, total: 2 },
    preferred: { evidenced: 1, total: 1 },
    workAuthorizationStatus: "exact_match",
    notEvidencedRequiredCount: 1,
    unassessedRequirementCount: 2,
    application: null,
    ...overrides,
  };
}

test("required-evidence sort is deterministic with documented tie-breakers", () => {
  const jobs = [
    summary("c", { required: { evidenced: 1, total: 4 }, title: "Zulu" }),
    summary("b", {
      required: { evidenced: 2, total: 4 },
      notEvidencedRequiredCount: 2,
      title: "Beta",
    }),
    summary("a", {
      required: { evidenced: 2, total: 3 },
      notEvidencedRequiredCount: 1,
      title: "Alpha",
    }),
  ];

  assert.deepEqual(
    sortOwnedJobMatchSummaries(jobs, "required_evidence").map(
      (job) => job.jobId,
    ),
    ["a", "b", "c"],
  );
  assert.deepEqual(jobs.map((job) => job.jobId), ["c", "b", "a"]);
});

test("missing-required and recent sorts use stable updated and identity ties", () => {
  const jobs = [
    summary("b", {
      title: "Beta",
      updatedAt: "2026-07-19T10:00:00.000Z",
      notEvidencedRequiredCount: 3,
    }),
    summary("a", {
      title: "Alpha",
      updatedAt: "2026-07-20T10:00:00.000Z",
      notEvidencedRequiredCount: 3,
    }),
    summary("c", {
      title: "Gamma",
      updatedAt: "2026-07-21T10:00:00.000Z",
      notEvidencedRequiredCount: 1,
    }),
  ];

  assert.deepEqual(
    sortOwnedJobMatchSummaries(jobs, "missing_required").map(
      (job) => job.jobId,
    ),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    sortOwnedJobMatchSummaries(jobs, "recently_updated").map(
      (job) => job.jobId,
    ),
    ["c", "a", "b"],
  );
});

test("cards render safe summaries and drill down to Job Detail", () => {
  const html = renderToStaticMarkup(
    <JobMatchList jobs={[summary("job-a")]} sort="required_evidence" />,
  );

  assert.match(html, /Profile data|Comparable/);
  assert.match(html, /Required evidenced/);
  assert.match(html, /1 of 2/);
  assert.match(html, /Preferred evidenced/);
  assert.match(html, /Exact match found/);
  assert.match(html, /Not-evidenced required/);
  assert.match(html, /Unassessed/);
  assert.match(html, /href="\/jobs\/job-a"/);
  assert.match(html, />Start tracking</);
  assert.doesNotMatch(html, /overall score|match score|qualified|ranking/i);
});

test("tracked card shows status and links to the owned application", () => {
  const html = renderToStaticMarkup(
    <JobMatchList
      jobs={[
        summary("job-a", {
          application: {
            id: "application-a",
            jobPostingId: "job-a",
            status: "tailoring",
          },
        }),
      ]}
      sort="required_evidence"
    />,
  );

  assert.match(html, /Application status/);
  assert.match(html, /Tailoring/);
  assert.match(html, /href="\/applications\/application-a"/);
  assert.match(html, /Open application/);
  assert.doesNotMatch(html, />Start tracking</);
});

test("sort controls expose all labels and recommendation disclaimer", () => {
  const html = renderToStaticMarkup(
    <JobMatchList jobs={[summary("job-a")]} sort="required_evidence" />,
  );

  assert.match(html, /aria-label="Sort profile matches"/);
  assert.match(html, /Required evidence first/);
  assert.match(html, /Most missing required evidence/);
  assert.match(html, /Recently updated/);
  assert.match(html, /not an eligibility or hiring recommendation/i);
  assert.match(html, /aria-current="page"/);
});

test("insufficient-profile and invalid-extraction cards remain safe", () => {
  const html = renderToStaticMarkup(
    <JobMatchList
      jobs={[
        summary("profile", { status: "insufficient_profile" }),
        summary("invalid", {
          status: "invalid_extraction",
          required: null,
          preferred: null,
          workAuthorizationStatus: null,
          notEvidencedRequiredCount: null,
          unassessedRequirementCount: null,
        }),
      ]}
      sort="required_evidence"
    />,
  );

  assert.match(html, /Profile data needed/);
  assert.match(html, /Match unavailable/);
  assert.doesNotMatch(html, /schema|parser|SQL|raw extraction/i);
});

test("insufficient-job card uses the safe no-comparable state", () => {
  const html = renderToStaticMarkup(
    <JobMatchList
      jobs={[summary("job", { status: "insufficient_job_data" })]}
      sort="required_evidence"
    />,
  );

  assert.match(html, /No comparable requirements/);
  assert.match(html, /no supported requirements to compare/i);
});

test("empty list renders analyzed-jobs guidance", () => {
  const html = renderToStaticMarkup(
    <JobMatchList jobs={[]} sort="required_evidence" />,
  );
  assert.match(html, /No analyzed jobs yet/);
  assert.match(html, /href="\/jobs"/);
});

test("route uses one batch coordinator and navigation exposes the view", () => {
  const page = readFileSync("app/(app)/jobs/matches/page.tsx", "utf8");
  const jobsPage = readFileSync("app/(app)/jobs/jobs-page-client.tsx", "utf8");

  assert.equal((page.match(/getOwnedJobMatches\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(page, /getOwnedJobMatch\(/);
  assert.doesNotMatch(page, /matchScore/);
  assert.match(page, /getLoginHref\("\/jobs\/matches"\)/);
  assert.match(jobsPage, /href="\/jobs\/matches"/);
});
