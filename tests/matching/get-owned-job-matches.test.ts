import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createOwnedJobMatchesCoordinator,
  type OwnedJobMatchesDependencies,
} from "../../lib/matching/get-owned-job-matches";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  parseJobExtractionOutput,
} from "../../lib/ai/schemas/job-extraction";
import type { MasterProfileData } from "../../lib/master-profile/types";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";

const USER_ID = "2fa1b93d-91fc-41cb-a199-7aa3b9547ef5";
const JOB_A = "46c24649-4b46-4ef4-8daf-49f575e6fe84";
const JOB_B = "a77e376d-2d88-413a-b889-38fac2e31016";

function extraction(requiredSkills = ["TypeScript"], preferredSkills = ["Git"]) {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Example", confidence: 0.9 },
    title: { value: "Developer", confidence: 0.9 },
    location: { value: null, confidence: 0 },
    workMode: { value: null, confidence: 0 },
    term: { value: null, confidence: 0 },
    deadline: { value: null, confidence: 0 },
    namedSkills: { value: [...requiredSkills, ...preferredSkills], confidence: 0.9 },
    responsibilities: { value: ["Build features"], confidence: 0.8 },
    requirements: { value: requiredSkills, confidence: 0.8 },
    structuredRequirements: {
      requiredSkills,
      preferredSkills,
      requiredTechnologies: [],
      preferredTechnologies: [],
      education: [],
      certifications: [],
      languages: [],
      workAuthorization: ["Eligible to work in Canada"],
      experience: [],
      responsibilities: ["Build features"],
      softSkills: [],
      keywords: [],
      uncategorizedRequirements: [],
    },
    overallConfidence: 0.88,
  };
}

function profile(): MasterProfileData {
  return {
    fullName: "Private Candidate",
    email: "candidate@example.invalid",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "Eligible to work in Canada",
    preferredLocations: [],
    targetRoles: [],
    skills: ["TypeScript"],
    entries: [],
  };
}

function dependencies(
  overrides: Partial<OwnedJobMatchesDependencies> = {},
): OwnedJobMatchesDependencies {
  return {
    getAuthenticatedUser: async () => ({
      status: "authenticated",
      user: { id: USER_ID, email: "candidate@example.invalid" },
    }),
    getOwnedProfile: async () => ({ status: "ready", profile: profile() }),
    getOwnedJobs: async () => ({
      status: "ready",
      jobs: [
        {
          id: JOB_A,
          title: "Developer",
          companyName: "Example",
          location: "Vancouver, BC",
          updatedAt: "2026-07-20T10:00:00.000Z",
          extracted: extraction(),
        },
      ],
    }),
    getOwnedApplications: async () => ({
      status: "ready",
      applications: [],
    }),
    parseExtraction: parseJobExtractionOutput,
    match: matchResumeToJob,
    ...overrides,
  };
}

test("authenticates once and loads one profile plus one owner job batch", async () => {
  const calls: string[] = [];
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getAuthenticatedUser: async () => {
        calls.push("auth");
        return {
          status: "authenticated",
          user: { id: USER_ID, email: "candidate@example.invalid" },
        };
      },
      getOwnedProfile: async ({ userId }) => {
        calls.push(`profile:${userId}`);
        return { status: "ready", profile: profile() };
      },
      getOwnedJobs: async ({ userId }) => {
        calls.push(`jobs:${userId}`);
        return {
          status: "ready",
          jobs: [
            {
              id: JOB_A,
              title: "Developer",
              companyName: "Example",
              location: null,
              updatedAt: "2026-07-20T10:00:00.000Z",
              extracted: extraction(),
            },
          ],
        };
      },
      getOwnedApplications: async ({ userId }) => {
        calls.push(`applications:${userId}`);
        return { status: "ready", applications: [] };
      },
    }),
  );

  const result = await coordinate();
  assert.equal(result.status, "ready");
  assert.deepEqual(calls.sort(), [
    `applications:${USER_ID}`,
    "auth",
    `jobs:${USER_ID}`,
    `profile:${USER_ID}`,
  ]);
});

test("joins one owner-scoped application batch to matching summaries", async () => {
  let applicationCalls = 0;
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedApplications: async ({ userId }) => {
        applicationCalls += 1;
        assert.equal(userId, USER_ID);
        return {
          status: "ready",
          applications: [
            { id: JOB_B, jobPostingId: JOB_A, status: "tailoring" },
          ],
        };
      },
    }),
  );

  const result = await coordinate();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(applicationCalls, 1);
  assert.deepEqual(result.jobs[0]?.application, {
    id: JOB_B,
    jobPostingId: JOB_A,
    status: "tailoring",
  });
});

test("does not attach application IDs or statuses for a different job", async () => {
  const foreignApplicationId = "bbbc2464-4b46-4ef4-8daf-49f575e6fe84";
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedApplications: async () => ({
        status: "ready",
        applications: [
          {
            id: foreignApplicationId,
            jobPostingId: JOB_B,
            status: "offer",
          },
        ],
      }),
    }),
  );

  const result = await coordinate();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.jobs[0]?.application, null);
  assert.equal(JSON.stringify(result).includes(foreignApplicationId), false);
  assert.equal(JSON.stringify(result).includes('"offer"'), false);
});

test("returns only owner-scoped UI summaries without raw inputs", async () => {
  let receivedUserId = "";
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedJobs: async ({ userId }) => {
        receivedUserId = userId;
        return {
          status: "ready",
          jobs: [
            {
              id: JOB_A,
              title: "Developer",
              companyName: "Example",
              location: "Vancouver, BC",
              updatedAt: "2026-07-20T10:00:00.000Z",
              extracted: {
                ...extraction(),
                privateMarker: "PRIVATE_RAW_EXTRACTION",
              },
            },
          ],
        };
      },
    }),
  );

  const serialized = JSON.stringify(await coordinate());
  assert.equal(receivedUserId, USER_ID);
  assert.equal(serialized.includes("PRIVATE_RAW_EXTRACTION"), false);
  assert.equal(serialized.includes("candidate@example.invalid"), false);
  assert.equal(serialized.includes("matchScore"), false);
});

test("invalid extraction affects only its own analyzed job", async () => {
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedJobs: async () => ({
        status: "ready",
        jobs: [
          {
            id: JOB_A,
            title: "Valid",
            companyName: null,
            location: null,
            updatedAt: "2026-07-20T10:00:00.000Z",
            extracted: extraction(),
          },
          {
            id: JOB_B,
            title: "Invalid",
            companyName: null,
            location: null,
            updatedAt: "2026-07-19T10:00:00.000Z",
            extracted: { private: "malformed" },
          },
        ],
      }),
    }),
  );

  const result = await coordinate();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.deepEqual(
    result.jobs.map((job) => [job.jobId, job.status]),
    [
      [JOB_A, "comparable"],
      [JOB_B, "invalid_extraction"],
    ],
  );
});

test("each valid extraction is matched independently exactly once", async () => {
  let parseCalls = 0;
  let matchCalls = 0;
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedJobs: async () => ({
        status: "ready",
        jobs: [
          {
            id: JOB_A,
            title: "First",
            companyName: null,
            location: null,
            updatedAt: "2026-07-20T10:00:00.000Z",
            extracted: extraction(),
          },
          {
            id: JOB_B,
            title: "Second",
            companyName: null,
            location: null,
            updatedAt: "2026-07-19T10:00:00.000Z",
            extracted: extraction(["JavaScript"], []),
          },
        ],
      }),
      parseExtraction(value) {
        parseCalls += 1;
        return parseJobExtractionOutput(value);
      },
      match(requirements, candidate) {
        matchCalls += 1;
        return matchResumeToJob(requirements, candidate);
      },
    }),
  );

  const result = await coordinate();
  assert.equal(result.status, "ready");
  assert.equal(parseCalls, 2);
  assert.equal(matchCalls, 2);
});

test("valid extraction without comparable fields remains an insufficient-job state", async () => {
  const empty = extraction([], []);
  empty.structuredRequirements.workAuthorization = [];
  empty.structuredRequirements.responsibilities = [];
  empty.responsibilities.value = [];
  empty.requirements.value = [];

  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedJobs: async () => ({
        status: "ready",
        jobs: [
          {
            id: JOB_A,
            title: "No comparable fields",
            companyName: null,
            location: null,
            updatedAt: "2026-07-20T10:00:00.000Z",
            extracted: empty,
          },
        ],
      }),
    }),
  );

  const result = await coordinate();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.jobs[0]?.status, "insufficient_job_data");
});

test("jobs without persisted analysis are excluded from the view", async () => {
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedJobs: async () => ({
        status: "ready",
        jobs: [
          {
            id: JOB_A,
            title: "Not analyzed",
            companyName: null,
            location: null,
            updatedAt: "2026-07-20T10:00:00.000Z",
            extracted: {},
          },
        ],
      }),
    }),
  );

  assert.deepEqual(await coordinate(), { status: "ready", jobs: [] });
});

test("missing profile produces an insufficient-profile summary", async () => {
  const coordinate = createOwnedJobMatchesCoordinator(
    dependencies({ getOwnedProfile: async () => ({ status: "missing" }) }),
  );
  const result = await coordinate();
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.jobs[0]?.status, "insufficient_profile");
  assert.deepEqual(result.jobs[0]?.required, { evidenced: 0, total: 1 });
});

test("unauthenticated and unavailable dependencies fail safely", async () => {
  let profileCalls = 0;
  let jobsCalls = 0;
  let applicationCalls = 0;
  const unauthenticated = createOwnedJobMatchesCoordinator(
    dependencies({
      getAuthenticatedUser: async () => ({ status: "unauthenticated" }),
      getOwnedProfile: async () => {
        profileCalls += 1;
        return { status: "missing" };
      },
      getOwnedJobs: async () => {
        jobsCalls += 1;
        return { status: "ready", jobs: [] };
      },
      getOwnedApplications: async () => {
        applicationCalls += 1;
        return { status: "ready", applications: [] };
      },
    }),
  );
  assert.deepEqual(await unauthenticated(), { status: "unauthenticated" });
  assert.equal(profileCalls, 0);
  assert.equal(jobsCalls, 0);
  assert.equal(applicationCalls, 0);

  const unavailable = createOwnedJobMatchesCoordinator(
    dependencies({
      getOwnedJobs: async () => ({ status: "unavailable" }),
    }),
  );
  assert.deepEqual(await unavailable(), { status: "unavailable" });
});

test("batch coordinator has no provider, credit, or write dependency", async () => {
  const configured = dependencies();
  for (const key of [
    "provider",
    "openAI",
    "reserveCredit",
    "finalizeCredit",
    "persist",
    "write",
  ]) {
    assert.equal(key in configured, false);
  }
  assert.equal((await createOwnedJobMatchesCoordinator(configured)()).status, "ready");
});

test("production query excludes raw text and legacy match score and scopes by owner", () => {
  const querySource = readFileSync("lib/jobs/queries.ts", "utf8");
  const matchColumns = querySource.slice(
    querySource.indexOf("const PRIVATE_JOB_MATCH_COLUMNS"),
    querySource.indexOf("type CompanyRelation"),
  );
  const batchQuery = querySource.slice(
    querySource.indexOf("export async function getPrivateJobsForMatching"),
    querySource.indexOf("export async function getPrivateJobForWorkflow"),
  );

  assert.doesNotMatch(matchColumns, /raw_text|match_score/i);
  assert.match(matchColumns, /"extracted"/);
  assert.match(batchQuery, /\.eq\("user_id", userId\)/);
  assert.equal((batchQuery.match(/\.from\("job_postings"\)/g) ?? []).length, 1);

  const applicationQueries = readFileSync("lib/applications/queries.ts", "utf8");
  const trackingBatch = applicationQueries.slice(
    applicationQueries.indexOf("export async function getOwnedApplicationTrackingLinks"),
    applicationQueries.indexOf(
      "export async function getOwnedApplicationTrackingLinkForJob",
    ),
  );
  assert.equal((trackingBatch.match(/\.from\("applications"\)/g) ?? []).length, 1);
  assert.match(trackingBatch, /\.eq\("user_id", userId\)/);
});
