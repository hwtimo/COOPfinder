import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ApplicationWorkflowSummary } from "../../components/app/application-workflow-summary";
import { ApplicationTrackingControl } from "../../components/jobs/application-tracking-control";
import type { OwnedApplicationWorkflowResult } from "../../lib/applications/get-owned-application-workflow";

const JOB_ID = "c71a0000-0000-4000-8000-000000000001";
const APPLICATION_ID = "d71a0000-0000-4000-8000-000000000001";
const VERSION_ID = "b71a0000-0000-4000-8000-000000000001";

function readyResult(): OwnedApplicationWorkflowResult {
  return {
    status: "ready",
    workflow: {
      analysis: "ready",
      match: "comparable",
      tailoring: "ready",
      resume: { status: "ready", versionId: VERSION_ID },
    },
  };
}

test("workflow renders four independent states and safe owned-record links", () => {
  const html = renderToStaticMarkup(
    <ApplicationWorkflowSummary
      jobId={JOB_ID}
      sourceUrl="https://jobs.example.invalid/posting"
      result={readyResult()}
    />,
  );

  assert.match(html, /Saved job analysis/);
  assert.match(html, /Deterministic Profile Match/);
  assert.match(html, /Tailoring preflight/);
  assert.match(html, /Saved tailored resume/);
  assert.match(html, new RegExp(`href="/jobs/${JOB_ID}"`));
  assert.match(html, new RegExp(`href="/resumes/tailor/${JOB_ID}"`));
  assert.match(html, new RegExp(`href="/resumes/versions/${VERSION_ID}"`));
  assert.match(html, /href="https:\/\/jobs\.example\.invalid\/posting"/);
  assert.match(html, /noopener noreferrer/);
  assert.doesNotMatch(html, /overall score|match score|eligible|ready to be hired/i);
});

test("insufficient and unavailable states remain informational", () => {
  const result: OwnedApplicationWorkflowResult = {
    status: "ready",
    workflow: {
      analysis: "ready",
      match: "insufficient_profile",
      tailoring: "unavailable",
      resume: { status: "none" },
    },
  };
  const html = renderToStaticMarkup(
    <ApplicationWorkflowSummary jobId={JOB_ID} sourceUrl={null} result={result} />,
  );
  assert.match(html, /More profile evidence needed/);
  assert.match(html, /Unavailable/);
  assert.match(html, /No complete saved resume/);
  assert.match(html, /do not change the application status/);
  assert.doesNotMatch(html, /Open saved resume/);
});

test("untracked control is accessible and tracked control links to the application", () => {
  const untracked = renderToStaticMarkup(
    <ApplicationTrackingControl jobId={JOB_ID} application={null} />,
  );
  assert.match(untracked, /<button[^>]*type="button"/);
  assert.match(untracked, />Start tracking</);

  const tracked = renderToStaticMarkup(
    <ApplicationTrackingControl
      jobId={JOB_ID}
      application={{
        id: APPLICATION_ID,
        jobPostingId: JOB_ID,
        status: "applied",
      }}
    />,
  );
  assert.match(tracked, /Application status/);
  assert.match(tracked, /Applied/);
  assert.match(tracked, new RegExp(`href="/applications/${APPLICATION_ID}"`));
  assert.match(tracked, /Open application/);
});

test("workflow and tracking layouts remain one-column-first and responsive", () => {
  const workflow = renderToStaticMarkup(
    <ApplicationWorkflowSummary
      jobId={JOB_ID}
      sourceUrl={null}
      result={readyResult()}
    />,
  );
  const tracking = renderToStaticMarkup(
    <ApplicationTrackingControl
      jobId={JOB_ID}
      application={{
        id: APPLICATION_ID,
        jobPostingId: JOB_ID,
        status: "saved",
      }}
    />,
  );
  assert.match(workflow, /grid gap-3 md:grid-cols-2/);
  assert.match(tracking, /flex flex-col gap-3/);
  assert.match(tracking, /sm:flex-row/);
});

test("product pages use the reusable tracking control and read-only workflow", () => {
  const jobPage = readFileSync("app/(app)/jobs/[id]/page.tsx", "utf8");
  const applicationPage = readFileSync(
    "app/(app)/applications/[id]/page.tsx",
    "utf8",
  );
  const action = readFileSync("app/(app)/applications/actions.ts", "utf8");

  assert.match(jobPage, /<ApplicationTrackingControl/);
  assert.match(jobPage, /getOwnedApplicationTrackingLinkForJob/);
  assert.match(applicationPage, /title="Application workflow"/);
  assert.match(applicationPage, /<ApplicationWorkflowSummary/);
  assert.match(action, /revalidatePath\("\/jobs\/matches"\)/);
  assert.doesNotMatch(applicationPage, /matchScore|match_score/);
});
