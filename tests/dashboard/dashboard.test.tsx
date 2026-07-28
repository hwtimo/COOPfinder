import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDashboardViewModel } from "../../lib/dashboard/view-model";

import type { DashboardData, DashboardJob } from "../../lib/dashboard/types";

const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
const query = readFileSync("lib/dashboard/queries.ts", "utf8");
const dashboardProductionSources = [page, query].join("\n");

const jobs: DashboardJob[] = [
  {
    id: "a",
    title: "Platform Intern",
    companyName: "Alpha",
    location: "Vancouver",
    deadline: "2026-07-30",
    status: "saved",
    intakeSource: "pasted_url",
    hasRawText: false,
    hasAnalysis: false,
    updatedAt: "2026-07-24T12:00:00.000Z",
  },
  {
    id: "b",
    title: "Web Intern",
    companyName: "Beta",
    location: "Burnaby",
    deadline: "2026-07-28",
    status: "ready",
    intakeSource: "pasted_text",
    hasRawText: true,
    hasAnalysis: true,
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "c",
    title: "Data Intern",
    companyName: "Gamma",
    location: null,
    deadline: "2026-07-28",
    status: "rejected",
    intakeSource: "manual",
    hasRawText: true,
    hasAnalysis: true,
    updatedAt: "2026-07-25T12:00:00.000Z",
  },
  {
    id: "d",
    title: "QA Intern",
    companyName: null,
    location: null,
    deadline: "2026-07-24",
    status: "applied",
    intakeSource: "pasted_text",
    hasRawText: true,
    hasAnalysis: true,
    updatedAt: "2026-07-23T12:00:00.000Z",
  },
];

test("Dashboard view model derives counts and stable ordering from persisted rows", () => {
  const data: DashboardData = {
    hasMasterProfile: true,
    jobs,
    applications: [
      {
        id: "application-1",
        jobPostingId: "a",
        status: "saved",
        updatedAt: "2026-07-24T13:00:00.000Z",
      },
      {
        id: "application-2",
        jobPostingId: "b",
        status: "saved",
        updatedAt: "2026-07-25T13:00:00.000Z",
      },
      {
        id: "application-3",
        jobPostingId: "c",
        status: "interview",
        updatedAt: "2026-07-25T14:00:00.000Z",
      },
    ],
    resumeVersions: [
      {
        id: "version-1",
        jobPostingId: "b",
        createdAt: "2026-07-25T13:30:00.000Z",
      },
    ],
  };

  const result = buildDashboardViewModel(
    data,
    new Date("2026-07-25T15:00:00.000Z"),
  );

  assert.equal(result.totalJobs, 4);
  assert.equal(result.totalApplications, 3);
  assert.equal(result.upcomingDeadlineCount, 2);
  assert.equal(result.mode, "active");
  assert.equal(result.primaryAction.kind, "add_job_text");
  assert.ok(result.queuedActions.length <= 3);
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
    {
      hasMasterProfile: false,
      jobs: [],
      applications: [],
      resumeVersions: [],
    },
    new Date("2026-07-25T15:00:00.000Z"),
  );

  assert.equal(result.totalJobs, 0);
  assert.equal(result.totalApplications, 0);
  assert.equal(result.upcomingDeadlineCount, 0);
  assert.deepEqual(result.recentJobs, []);
  assert.deepEqual(result.upcomingJobs, []);
  assert.ok(result.pipeline.every((stage) => stage.count === 0));
  assert.equal(result.mode, "onboarding");
  assert.equal(result.primaryAction.kind, "complete_profile");
  assert.deepEqual(
    result.onboardingMilestones.map((milestone) => [
      milestone.id,
      milestone.complete,
    ]),
    [
      ["profile", false],
      ["first_job", false],
      ["first_analysis", false],
      ["first_tailored_resume", false],
    ],
  );
});

test("onboarding advances in persisted milestone order", () => {
  const result = buildDashboardViewModel(
    {
      hasMasterProfile: true,
      jobs: [jobs[0]],
      applications: [],
      resumeVersions: [],
    },
    new Date("2026-07-25T15:00:00.000Z"),
  );

  assert.equal(result.mode, "onboarding");
  assert.equal(result.primaryAction.kind, "analyze_job");
  assert.equal(result.primaryAction.href, "/jobs/a");
  assert.deepEqual(
    result.onboardingMilestones.map((milestone) => milestone.complete),
    [true, true, false, false],
  );
  assert.deepEqual(result.queuedActions, []);
});

test("active actions use fixed priority and stable deadline, update, and id tie-breakers", () => {
  const actionJobs: DashboardJob[] = [
    {
      ...jobs[0],
      id: "url-b",
      title: "URL B",
      deadline: "2026-08-02",
      updatedAt: "2026-07-21T00:00:00.000Z",
    },
    {
      ...jobs[0],
      id: "url-a",
      title: "URL A",
      deadline: "2026-08-01",
      updatedAt: "2026-07-22T00:00:00.000Z",
    },
    {
      ...jobs[1],
      id: "analyze",
      title: "Analyze",
      hasAnalysis: false,
    },
    {
      ...jobs[1],
      id: "tailor",
      title: "Tailor",
    },
    {
      ...jobs[1],
      id: "track",
      title: "Track",
    },
  ];
  const result = buildDashboardViewModel({
    hasMasterProfile: true,
    jobs: actionJobs,
    applications: [],
    resumeVersions: [
      {
        id: "track-version",
        jobPostingId: "track",
        createdAt: "2026-07-25T00:00:00.000Z",
      },
    ],
  });

  assert.equal(result.mode, "active");
  assert.equal(result.primaryAction.id, "add-job-text:url-a");
  assert.deepEqual(
    result.queuedActions.map((action) => action.id),
    [
      "add-job-text:url-b",
      "analyze-job:analyze",
      "tailor-resume:tailor",
    ],
  );
  assert.equal(result.queuedActions.length, 3);
});

test("Dashboard query returns only owner-scoped display summaries", () => {
  assert.match(query, /import "server-only"/);
  assert.match(query, /\.from\("master_profiles"\)/);
  assert.match(query, /\.from\("job_postings"\)/);
  assert.match(query, /\.from\("applications"\)/);
  assert.match(query, /\.from\("resume_versions"\)/);
  assert.equal(
    [...query.matchAll(/\.eq\("user_id", userId\)/g)].length,
    4,
  );
  assert.match(query, /hasRawText:/);
  assert.match(query, /hasAnalysis:/);
  assert.match(query, /parseJobExtractionOutput/);
  assert.match(query, /parseTailoredResumeVersionContent/);
  assert.doesNotMatch(page, /raw_text|extracted|profile prose|match_score/);
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

test("Dashboard has explicit unavailable, onboarding, and active next-action states", () => {
  assert.match(page, /if \(!getSupabaseEnv\(\)\)/);
  assert.match(page, /if \(result\.status === "error"\)/);
  assert.match(page, /No fallback data is shown\./);
  assert.match(page, /dashboard\.mode === "onboarding"/);
  assert.match(page, /title="Getting started"/);
  assert.match(page, /title="Next action"/);
  assert.match(page, /aria-current=\{isCurrent \? "step" : undefined\}/);
  assert.match(page, /isCurrent\s*\?\s*"Current step"/);
  assert.match(page, />\s*Continue\s*</);
  assert.match(page, />\s*Open next action\s*</);
  assert.match(page, /dashboard\.primaryAction\.href/);
  assert.match(page, /dashboard\.queuedActions\.map/);
});

test("Dashboard removes analytics cards and competing persisted-data panels", () => {
  assert.doesNotMatch(
    page,
    /MetricCard|DashboardRecentJobRow|pipelineTone|pipelineTotal/,
  );
  assert.doesNotMatch(
    page,
    /Application pipeline|Recent jobs|Upcoming deadlines|Tracked applications/,
  );
  assert.doesNotMatch(page, /Math\.round|style=\{\{ width|%/);
});
