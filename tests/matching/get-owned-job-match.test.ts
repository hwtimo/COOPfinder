import assert from "node:assert/strict";
import test from "node:test";

import {
  createOwnedJobMatchCoordinator,
  getOwnedJobMatch,
  type OwnedJobMatchDependencies,
} from "../../lib/matching/get-owned-job-match";
import type { MasterProfileData } from "../../lib/master-profile/types";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  parseJobExtractionOutput,
} from "../../lib/ai/schemas/job-extraction";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";

const USER_ID = "2fa1b93d-91fc-41cb-a199-7aa3b9547ef5";
const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

function extraction() {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Example", confidence: 0.9 },
    title: { value: "Developer", confidence: 0.9 },
    location: { value: null, confidence: 0 },
    workMode: { value: null, confidence: 0 },
    term: { value: null, confidence: 0 },
    deadline: { value: null, confidence: 0 },
    namedSkills: { value: ["TypeScript", "Git"], confidence: 0.9 },
    responsibilities: { value: ["Build product features"], confidence: 0.8 },
    requirements: { value: ["Enrolled in a co-op program"], confidence: 0.8 },
    overallConfidence: 0.88,
  };
}

function profile(overrides: Partial<MasterProfileData> = {}): MasterProfileData {
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
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<OwnedJobMatchDependencies> = {},
): OwnedJobMatchDependencies {
  return {
    getAuthenticatedUser: async () => ({
      status: "authenticated",
      user: { id: USER_ID, email: "private@example.invalid" },
    }),
    getOwnedJob: async () => ({
      status: "ready",
      job: { id: JOB_ID, extracted: extraction() },
    }),
    getOwnedProfile: async () => ({
      status: "ready",
      profile: profile(),
    }),
    parseExtraction: parseJobExtractionOutput,
    match: matchResumeToJob,
    ...overrides,
  };
}

test("authenticated owner with valid extraction and profile returns matched", async () => {
  const coordinate = createOwnedJobMatchCoordinator(dependencies());
  const result = await coordinate(JOB_ID);

  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.jobId, JOB_ID);
  assert.equal(result.match.status, "comparable");
  assert.equal(result.match.keywords.matchedCount, 1);
  assert.equal(result.match.keywords.notEvidencedItems.length, 1);
});

test("passes the pure matcher output through unchanged", async () => {
  const parsed = parseJobExtractionOutput(extraction());
  assert.equal(parsed.status, "valid");
  if (parsed.status !== "valid") return;
  const expected = matchResumeToJob(
    parsed.canonicalRequirements,
    profile(),
  );
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({ match: () => expected }),
  );

  const result = await coordinate(JOB_ID);
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.match, expected);
});

test("extended extraction reaches the pure matcher without coordinator changes", async () => {
  const extended = {
    ...extraction(),
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
      responsibilities: ["Build product features"],
      softSkills: [],
      keywords: ["Git"],
      uncategorizedRequirements: [],
    },
  };
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: { id: JOB_ID, extracted: extended },
      }),
    }),
  );

  const result = await coordinate(JOB_ID);
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.match.required.matchedCount, 1);
  assert.equal(result.match.keywords.notEvidencedItems.length, 1);
});

test("structured candidate evidence reaches additive matcher groups unchanged", async () => {
  const extended = {
    ...extraction(),
    structuredRequirements: {
      requiredSkills: [],
      preferredSkills: [],
      requiredTechnologies: ["TypeScript"],
      preferredTechnologies: [],
      education: [],
      certifications: ["AWS Certified Developer"],
      languages: ["French"],
      workAuthorization: [],
      experience: [],
      responsibilities: [],
      softSkills: ["Communication"],
      keywords: [],
      uncategorizedRequirements: [],
    },
  };
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: { id: JOB_ID, extracted: extended },
      }),
      getOwnedProfile: async () => ({
        status: "ready",
        profile: profile({
          candidateEvidence: {
            technologies: ["TypeScript"],
            softSkills: ["Communication"],
            certifications: ["AWS Certified Developer"],
            languages: [{ language: "French", proficiency: "basic" }],
          },
        }),
      }),
    }),
  );

  const result = await coordinate(JOB_ID);
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.match.required.matchedCount, 1);
  assert.equal(result.match.softSkills.matchedCount, 1);
  assert.equal(result.match.certifications.matchedCount, 1);
  assert.equal(result.match.languages.matchedCount, 1);
  assert.equal(JSON.stringify(result.match).includes("basic"), false);
});

test("unauthenticated caller cannot load job or profile", async () => {
  let jobCalls = 0;
  let profileCalls = 0;
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getAuthenticatedUser: async () => ({ status: "unauthenticated" }),
      getOwnedJob: async () => {
        jobCalls += 1;
        return { status: "ready", job: null };
      },
      getOwnedProfile: async () => {
        profileCalls += 1;
        return { status: "missing" };
      },
    }),
  );

  assert.deepEqual(await coordinate(JOB_ID), { status: "unauthenticated" });
  assert.equal(jobCalls, 0);
  assert.equal(profileCalls, 0);
});

for (const label of ["absent", "non-owned"] as const) {
  test(`${label} job is returned as the same not-found state`, async () => {
    const coordinate = createOwnedJobMatchCoordinator(
      dependencies({
        getOwnedJob: async () => ({ status: "ready", job: null }),
      }),
    );

    assert.deepEqual(await coordinate(JOB_ID), { status: "not_found" });
  });
}

test("missing persisted extraction returns extraction unavailable", async () => {
  for (const extracted of [null, {}]) {
    const coordinate = createOwnedJobMatchCoordinator(
      dependencies({
        getOwnedJob: async () => ({
          status: "ready",
          job: { id: JOB_ID, extracted },
        }),
      }),
    );
    assert.deepEqual(await coordinate(JOB_ID), {
      status: "extraction_unavailable",
    });
  }
});

test("malformed persisted extraction returns invalid extraction", async () => {
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: { id: JOB_ID, extracted: { namedSkills: ["private"] } },
      }),
    }),
  );

  assert.deepEqual(await coordinate(JOB_ID), {
    status: "invalid_extraction",
  });
});

test("missing or unavailable Master Profile maps safely", async () => {
  for (const status of ["missing", "unavailable"] as const) {
    const coordinate = createOwnedJobMatchCoordinator(
      dependencies({ getOwnedProfile: async () => ({ status }) }),
    );
    assert.deepEqual(await coordinate(JOB_ID), {
      status: "profile_unavailable",
    });
  }
});

test("empty valid Master Profile returns the pure matcher status", async () => {
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getOwnedProfile: async () => ({
        status: "ready",
        profile: profile({ skills: [], entries: [] }),
      }),
    }),
  );

  const result = await coordinate(JOB_ID);
  assert.equal(result.status, "matched");
  if (result.status !== "matched") return;
  assert.equal(result.match.status, "insufficient_candidate_data");
});

test("matched result contains no raw job text or unrelated profile content", async () => {
  const rawJobMarker = "PRIVATE_RAW_JOB_TEXT";
  const profileMarker = "PRIVATE_PROFILE_PROSE";
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: {
          id: JOB_ID,
          extracted: extraction(),
          rawText: rawJobMarker,
        } as never,
      }),
      getOwnedProfile: async () => ({
        status: "ready",
        profile: profile({
          fullName: profileMarker,
          entries: [
            {
              id: "entry-1",
              section: "experience",
              source: profileMarker,
              text: profileMarker,
              skills: [],
              confirmed: true,
              sortOrder: 0,
            },
          ],
        }),
      }),
    }),
  );

  const serialized = JSON.stringify(await coordinate(JOB_ID));
  assert.equal(serialized.includes(rawJobMarker), false);
  assert.equal(serialized.includes(profileMarker), false);
});

test("uses authenticated identity for both owner-scoped loaders", async () => {
  const calls: string[] = [];
  const coordinate = createOwnedJobMatchCoordinator(
    dependencies({
      getAuthenticatedUser: async () => {
        calls.push("auth");
        return {
          status: "authenticated",
          user: { id: USER_ID, email: "private@example.invalid" },
        };
      },
      getOwnedJob: async (input) => {
        calls.push(`job:${input.userId}:${input.jobId}`);
        return { status: "ready", job: { id: JOB_ID, extracted: extraction() } };
      },
      getOwnedProfile: async (input) => {
        calls.push(`profile:${input.userId}`);
        return { status: "ready", profile: profile() };
      },
    }),
  );

  await (coordinate as (...args: string[]) => Promise<unknown>)(
    JOB_ID,
    "caller-supplied-user-id-is-ignored",
  );
  assert.deepEqual(calls, [
    "auth",
    `job:${USER_ID}:${JOB_ID}`,
    `profile:${USER_ID}`,
  ]);
});

test("coordinator has no provider dependency and invokes matching once", async () => {
  let matchCalls = 0;
  const configured = dependencies({
    match(requirements, candidate) {
      matchCalls += 1;
      return matchResumeToJob(requirements, candidate);
    },
  });
  const coordinate = createOwnedJobMatchCoordinator(configured);

  assert.equal("provider" in configured, false);
  assert.equal("openAI" in configured, false);
  await coordinate(JOB_ID);
  assert.equal(matchCalls, 1);
});

test("identical mocked inputs produce deterministic repeated results", async () => {
  const coordinate = createOwnedJobMatchCoordinator(dependencies());

  assert.deepEqual(await coordinate(JOB_ID), await coordinate(JOB_ID));
});

test("unexpected authentication, job, profile, parser, or matcher failures map safely", async () => {
  const failingDependencies: Array<Partial<OwnedJobMatchDependencies>> = [
    { getAuthenticatedUser: async () => { throw new Error("auth detail"); } },
    { getOwnedJob: async () => { throw new Error("job detail"); } },
    { getOwnedProfile: async () => { throw new Error("profile detail"); } },
    { parseExtraction: () => { throw new Error("parser detail"); } },
    { match: () => { throw new Error("matcher detail"); } },
  ];

  const expected = [
    "unavailable",
    "unavailable",
    "unavailable",
    "invalid_extraction",
    "unavailable",
  ];
  for (const [index, override] of failingDependencies.entries()) {
    const coordinate = createOwnedJobMatchCoordinator(dependencies(override));
    assert.equal((await coordinate(JOB_ID)).status, expected[index]);
  }
});

test("production coordinator accepts only a private job ID", () => {
  const acceptsOnlyJobId: (jobId: string) => Promise<unknown> = getOwnedJobMatch;
  assert.equal(typeof acceptsOnlyJobId, "function");
});
