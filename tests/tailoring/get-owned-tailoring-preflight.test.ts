import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JOB_REQUIREMENTS_VERSION,
  type CanonicalJobRequirements,
} from "../../lib/jobs/job-requirement-normalization";
import type { MasterProfileData } from "../../lib/master-profile/types";
import type { OwnedJobMatchContextResult } from "../../lib/matching/get-owned-job-match";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";
import {
  createOwnedTailoringPreflightCoordinator,
  getOwnedTailoringPreflight,
  type OwnedTailoringPreflightDependencies,
} from "../../lib/tailoring/get-owned-tailoring-preflight";
import { buildTailoringPreflight } from "../../lib/tailoring/tailoring-preflight";

const JOB_ID = "6892c5a6-387e-418a-b2c0-7f3561a65889";

function requirements(): CanonicalJobRequirements {
  return {
    contractVersion: CANONICAL_JOB_REQUIREMENTS_VERSION,
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
  };
}

function profile(): MasterProfileData {
  return {
    fullName: "Private candidate",
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

function matchedContext(): OwnedJobMatchContextResult {
  const canonicalRequirements = requirements();
  const masterProfile = profile();
  return {
    status: "matched",
    job: {
      id: JOB_ID,
      title: "Developer",
      companyName: "Example",
      location: "Vancouver",
      extracted: { private: "RAW_EXTRACTION" },
    },
    profile: masterProfile,
    canonicalRequirements,
    match: matchResumeToJob(canonicalRequirements, masterProfile),
  };
}

function dependencies(
  overrides: Partial<OwnedTailoringPreflightDependencies> = {},
): OwnedTailoringPreflightDependencies {
  return {
    getOwnedMatchContext: async () => matchedContext(),
    buildPreflight: buildTailoringPreflight,
    ...overrides,
  };
}

test("owner-scoped context produces a safe ready preflight", async () => {
  const coordinate = createOwnedTailoringPreflightCoordinator(dependencies());
  const result = await coordinate(JOB_ID);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.preflight.job.id, JOB_ID);
  assert.deepEqual(result.preflight.matched.requiredSkills, [
    { requirement: "TypeScript", matchedCandidateTerm: "TypeScript" },
  ]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private@example\.invalid|Private candidate|RAW_EXTRACTION/,
  );
});

for (const status of [
  "unauthenticated",
  "not_found",
  "extraction_unavailable",
  "profile_unavailable",
  "invalid_extraction",
  "unavailable",
] as const) {
  test(`preserves safe ${status} outcome without building a package`, async () => {
    let buildCalls = 0;
    const coordinate = createOwnedTailoringPreflightCoordinator(
      dependencies({
        getOwnedMatchContext: async () => ({ status }),
        buildPreflight: (input) => {
          buildCalls += 1;
          return buildTailoringPreflight(input);
        },
      }),
    );

    assert.deepEqual(await coordinate(JOB_ID), { status });
    assert.equal(buildCalls, 0);
  });
}

test("maps matcher insufficient states without changing their meaning", async () => {
  for (const matchStatus of [
    "insufficient_job_data",
    "insufficient_candidate_data",
  ] as const) {
    const context = matchedContext();
    assert.equal(context.status, "matched");
    if (context.status !== "matched") continue;
    const coordinate = createOwnedTailoringPreflightCoordinator(
      dependencies({
        getOwnedMatchContext: async () => ({
          ...context,
          match: { ...context.match, status: matchStatus },
        }),
      }),
    );
    const result = await coordinate(JOB_ID);
    assert.equal(result.status, matchStatus);
  }
});

test("unexpected context or package failures map to generic unavailable", async () => {
  const contextFailure = createOwnedTailoringPreflightCoordinator(
    dependencies({
      getOwnedMatchContext: async () => {
        throw new Error("PRIVATE_DATABASE_DETAIL");
      },
    }),
  );
  assert.deepEqual(await contextFailure(JOB_ID), { status: "unavailable" });

  const packageFailure = createOwnedTailoringPreflightCoordinator(
    dependencies({
      buildPreflight: () => {
        throw new Error("PRIVATE_PACKAGE_DETAIL");
      },
    }),
  );
  assert.deepEqual(await packageFailure(JOB_ID), { status: "unavailable" });
});

test("coordinator dependency surface has no provider, credit, or persistence operation", () => {
  const configured = dependencies();
  assert.deepEqual(Object.keys(configured).sort(), [
    "buildPreflight",
    "getOwnedMatchContext",
  ]);
  assert.equal("provider" in configured, false);
  assert.equal("credit" in configured, false);
  assert.equal("resumeVersion" in configured, false);
  assert.equal("persist" in configured, false);
  assert.equal(typeof getOwnedTailoringPreflight, "function");
});
