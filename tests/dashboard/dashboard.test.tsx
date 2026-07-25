import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { DashboardRecentJobRow } from "../../components/app/dashboard-recent-job-row";
import { buildDashboardViewModel } from "../../lib/dashboard/view-model";

import type { DashboardData, DashboardJob } from "../../lib/dashboard/types";

const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
const row = readFileSync(
  "components/app/dashboard-recent-job-row.tsx",
  "utf8",
);
const query = readFileSync("lib/dashboard/queries.ts", "utf8");
const dashboardProductionSources = [page, row, query].join("\n");

const jobs: DashboardJob[] = [
  {
    id: "a",
    title: "Platform Intern",
    companyName: "Alpha",
    location: "Vancouver",
    deadline: "2026-07-30",
    status: "saved",
    updatedAt: "2026-07-24T12:00:00.000Z",
  },
  {
    id: "b",
    title: "Web Intern",
    companyName: "Beta",
    location: "Burnaby",
    deadline: "2026-07-28",
    status: "ready",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "c",
    title: "Data Intern",
    companyName: "Gamma",
    location: null,
    deadline: "2026-07-28",
    status: "rejected",
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "d",
    title: "QA Intern",
    companyName: null,
    location: null,
    deadline: "2026-07-24",
    status: "applied",
    updatedAt: "2026-07-23T12:00:00.000Z",
  },
];

test("Dashboard view model derives counts and stable ordering from persisted rows", () => {
  const data: DashboardData = {
    jobs,
    applications: [
      { id: "application-1", status: "saved" },
      { id: "application-2", status: "saved" },
      { id: "application-3", status: "interview" },
    ],
  };

  const result = buildDashboardViewModel(
    data,
    new Date("2026-07-25T15:00:00.000Z"),
  );

  assert.equal(result.totalJobs, 4);
  assert.equal(result.totalApplications, 3);
  assert.equal(result.upcomingDeadlineCount, 2);
  assert.deepEqual(
    result.recentJobs.map((job) => job.id),
    ["b", "c", "a", "d"],
  );
  assert.deepEqual(
    result.upcomingJobs.map((job) => job.id),
    ["b", "a"],
  );
  assert.equal(
    result.pipeline.find((stage) => stage.id === "saved")?.count,
    2,
  );
  assert.equal(
    result.pipeline.find((stage) => stage.id === "interview")?.count,
    1,
  );
  assert.equal(
    result.pipeline.find((stage) => stage.id === "offer")?.count,
    0,
  );
});

test("empty persisted rows produce an honest zero-data model", () => {
  const result = buildDashboardViewModel(
    { jobs: [], applications: [] },
    new Date("2026-07-25T15:00:00.000Z"),
  );

  assert.equal(result.totalJobs, 0);
  assert.equal(result.totalApplications, 0);
  assert.equal(result.upcomingDeadlineCount, 0);
  assert.deepEqual(result.recentJobs, []);
  assert.deepEqual(result.upcomingJobs, []);
  assert.ok(result.pipeline.every((stage) => stage.count === 0));
});

test("Dashboard query returns only owner-scoped display summaries", () => {
  assert.match(query, /import "server-only"/);
  assert.match(query, /\.from\("job_postings"\)/);
  assert.match(query, /\.from\("applications"\)/);
  assert.equal(
    [...query.matchAll(/\.eq\("user_id", userId\)/g)].length,
    2,
  );
  assert.doesNotMatch(
    query,
    /raw_text|extracted|match_score|notes|user_id,|owner_id|profile/,
  );
});

test("Dashboard production code contains no mock data dependency or fabricated panels", () => {
  assert.doesNotMatch(dashboardProductionSources, /lib\/mock/);
  assert.doesNotMatch(dashboardProductionSources, /mockJobs|mockMetrics/);
  assert.doesNotMatch(dashboardProductionSources, /currentUser|Maya Chen/i);
  assert.doesNotMatch(
    dashboardProductionSources,
    /AI next actions|Resume performance|Estimated callback rate|Estimated match/,
  );
});

test("Dashboard has explicit configuration, load-error, and one-CTA new-account states", () => {
  assert.match(page, /if \(!getSupabaseEnv\(\)\)/);
  assert.match(page, /if \(result\.status === "error"\)/);
  assert.match(page, /No fallback data is shown\./);
  assert.match(page, /const isNewAccount =/);
  assert.match(page, /title="Start with your first saved job"/);
  assert.match(page, /actionLabel="Add first job"/);
  assert.match(page, /onActionHref="\/jobs"/);
  assert.equal([...page.matchAll(/actionLabel="Add first job"/g)].length, 1);
});

test("recent job row renders only persisted summary fields and a safe detail link", () => {
  const markup = renderToStaticMarkup(
    <table>
      <tbody>
        <DashboardRecentJobRow job={jobs[1]} />
      </tbody>
    </table>,
  );

  assert.match(markup, /Web Intern/);
  assert.match(markup, /Beta/);
  assert.match(markup, /Burnaby/);
  assert.match(markup, /Ready/);
  assert.match(markup, /href="\/jobs\/b"/);
  assert.doesNotMatch(markup, /match|next action|resume version/i);
});
