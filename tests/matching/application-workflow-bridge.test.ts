import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createApplicationFromJob } from "../../lib/applications/create-from-job";
import {
  createOwnedApplicationWorkflowCoordinator,
  type OwnedApplicationWorkflowDependencies,
} from "../../lib/applications/get-owned-application-workflow";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  parseJobExtractionOutput,
} from "../../lib/ai/schemas/job-extraction";
import type { MasterProfileData } from "../../lib/master-profile/types";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";
import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import { buildTailoredResumeDocument } from "../../lib/tailoring/tailored-resume-document";
import {
  buildTailoredResumeVersionContent,
  parseTailoredResumeVersionContent,
} from "../../lib/tailoring/tailored-resume-version-content";
import { buildTailoringPreflight } from "../../lib/tailoring/tailoring-preflight";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "../tailoring/tailoring-v2-fixtures";

const USER_ID = "a71a0000-0000-4000-8000-000000000001";
const JOB_ID = "c71a0000-0000-4000-8000-000000000001";
const VERSION_ID = "b71a0000-0000-4000-8000-000000000001";

function extraction() {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Example", confidence: 0.9 },
    title: { value: "Developer", confidence: 0.9 },
    location: { value: "Vancouver, BC", confidence: 0.8 },
    workMode: { value: null, confidence: 0 },
    term: { value: null, confidence: 0 },
    deadline: { value: null, confidence: 0 },
    namedSkills: { value: ["TypeScript"], confidence: 0.9 },
    responsibilities: { value: [], confidence: 0.8 },
    requirements: { value: ["TypeScript"], confidence: 0.8 },
    structuredRequirements: {
      requiredSkills: ["TypeScript"],
      preferredSkills: [],
      requiredTechnologies: [],
      preferredTechnologies: [],
      education: [],
      certifications: [],
      languages: [],
      workAuthorization: [],
      experience: [],
      responsibilities: [],
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
    email: "private@example.invalid",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: ["TypeScript"],
    entries: [],
  };
}

function v2Content() {
  const input = buildTailoringProviderInputV2(
    readyPreflightV2(),
    resumeSourceSnapshotV2(),
  );
  assert.equal(input.status, "success");
  if (input.status !== "success") throw new Error("expected input");
  const plan = validTailoringPlanV2();
  const document = buildTailoredResumeDocument(input.input, plan);
  assert.equal(document.status, "success");
  if (document.status !== "success") throw new Error("expected document");
  const content = buildTailoredResumeVersionContent(
    input.input,
    plan,
    document.document,
    document.document.sourceFingerprint,
  );
  assert.equal(content.status, "success");
  if (content.status !== "success") throw new Error("expected content");
  return content.content;
}

function dependencies(
  overrides: Partial<OwnedApplicationWorkflowDependencies> = {},
): OwnedApplicationWorkflowDependencies {
  return {
    getOwnedJob: async () => ({
      status: "ready",
      job: {
        id: JOB_ID,
        title: "Developer",
        companyName: "Example",
        location: "Vancouver, BC",
        updatedAt: "2026-07-20T10:00:00.000Z",
        extracted: extraction(),
      },
    }),
    getOwnedProfile: async () => ({ status: "ready", profile: profile() }),
    getOwnedResumeVersions: async () => ({ status: "ready", versions: [] }),
    parseExtraction: parseJobExtractionOutput,
    match: matchResumeToJob,
    buildPreflight: buildTailoringPreflight,
    parseResumeVersion: parseTailoredResumeVersionContent,
    ...overrides,
  };
}

function coordinator(overrides: Partial<OwnedApplicationWorkflowDependencies> = {}) {
  return createOwnedApplicationWorkflowCoordinator(dependencies(overrides));
}

const input = { userId: USER_ID, email: "private@example.invalid", jobId: JOB_ID };

test("maps analyzed, comparable, ready-preflight, and no-resume states independently", async () => {
  const result = await coordinator()(input);
  assert.deepEqual(result, {
    status: "ready",
    workflow: {
      analysis: "ready",
      match: "comparable",
      tailoring: "ready",
      resume: { status: "none" },
    },
  });
});

test("maps insufficient profile and job states without an overall score", async () => {
  for (const status of [
    "insufficient_candidate_data",
    "insufficient_job_data",
  ] as const) {
    const result = await coordinator({
      match(requirements, candidate) {
        return { ...matchResumeToJob(requirements, candidate), status };
      },
    })(input);
    assert.equal(result.status, "ready");
    if (result.status !== "ready") continue;
    const expected =
      status === "insufficient_candidate_data"
        ? "insufficient_profile"
        : "insufficient_job_data";
    assert.equal(result.workflow.match, expected);
    assert.equal(result.workflow.tailoring, expected);
    assert.equal("score" in result.workflow, false);
  }
});

test("preflight failures remain unavailable without hiding valid analysis", async () => {
  const result = await coordinator({
    buildPreflight() {
      throw new Error("PRIVATE_PREFLIGHT_DETAIL");
    },
  })(input);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.workflow.analysis, "ready");
  assert.equal(result.workflow.match, "comparable");
  assert.equal(result.workflow.tailoring, "unavailable");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PREFLIGHT_DETAIL/);
});

test("selects the latest complete related v2 document and skips invalid or legacy content", async () => {
  const result = await coordinator({
    getOwnedResumeVersions: async ({ userId, jobId }) => {
      assert.equal(userId, USER_ID);
      assert.equal(jobId, JOB_ID);
      return {
        status: "ready",
        versions: [
          { id: "invalid", jobPostingId: JOB_ID, content: { unsafe: true } },
          { id: VERSION_ID, jobPostingId: JOB_ID, content: v2Content() },
          { id: "foreign-relation", jobPostingId: "other", content: v2Content() },
        ],
      };
    },
  })(input);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.deepEqual(result.workflow.resume, {
    status: "ready",
    versionId: VERSION_ID,
  });
});

test("no, legacy, invalid, and unavailable resume lookups map safely", async () => {
  for (const [getOwnedResumeVersions, expected] of [
    [
      async () => ({
        status: "ready" as const,
        versions: [
          {
            id: VERSION_ID,
            jobPostingId: JOB_ID,
            content: { contractVersion: "tailoring-plan-output-v1" },
          },
        ],
      }),
      "none",
    ],
    [async () => ({ status: "unavailable" as const }), "unavailable"],
  ] as const) {
    const result = await coordinator({ getOwnedResumeVersions })(input);
    assert.equal(result.status, "ready");
    if (result.status !== "ready") continue;
    assert.equal(result.workflow.resume.status, expected);
  }
});

test("all loaders receive the same owner and output excludes private source payloads", async () => {
  const calls: string[] = [];
  const result = await coordinator({
    getOwnedJob: async ({ userId, jobId }) => {
      calls.push(`job:${userId}:${jobId}`);
      return dependencies().getOwnedJob(input);
    },
    getOwnedProfile: async ({ userId }) => {
      calls.push(`profile:${userId}`);
      return { status: "ready", profile: profile() };
    },
    getOwnedResumeVersions: async ({ userId, jobId }) => {
      calls.push(`versions:${userId}:${jobId}`);
      return { status: "ready", versions: [] };
    },
  })(input);
  assert.deepEqual(calls.sort(), [
    `job:${USER_ID}:${JOB_ID}`,
    `profile:${USER_ID}`,
    `versions:${USER_ID}:${JOB_ID}`,
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private@example\.invalid|Private Candidate|structuredRequirements|TypeScript/,
  );
});

test("existing application creation path preserves created and idempotent results", async () => {
  for (const status of ["created", "already_exists"] as const) {
    let rpcCalls = 0;
    const supabase = {
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls += 1;
        assert.equal(name, "create_application_from_job");
        assert.deepEqual(args, { p_job_posting_id: JOB_ID });
        return {
          data: { result_status: status, application_id: VERSION_ID },
          error: null,
        };
      },
    } as unknown as SupabaseClient;
    assert.deepEqual(await createApplicationFromJob(supabase, JOB_ID), {
      status,
      applicationId: VERSION_ID,
    });
    assert.equal(rpcCalls, 1);
  }
});

test("workflow bridge is read-only and excludes provider, credit, status mutation, and legacy score paths", () => {
  const source = readFileSync(
    "lib/applications/get-owned-application-workflow.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("job_posting_id", jobId\)/);
  assert.doesNotMatch(
    source,
    /matchScore|match_score|provider|openai|credit|reservation|update_application_status|\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/i,
  );
});
