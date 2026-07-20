import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  parseJobExtractionOutput,
} from "../../lib/ai/schemas/job-extraction";
import type {
  MasterProfileData,
  MasterProfileSavePayload,
} from "../../lib/master-profile/types";
import { validateMasterProfilePayload } from "../../lib/master-profile/validation";
import {
  createOwnedJobMatchCoordinator,
  type OwnedJobMatchDependencies,
} from "../../lib/matching/get-owned-job-match";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";

const OWNER_ID = "9f397d65-d537-4905-838c-cdc78a0696ea";
const SECOND_USER_ID = "d03c1b5f-5af1-49cc-b96e-dc91660684b3";
const JOB_ID = "76f98ae1-5514-4b23-b31f-a6ead82fab31";

function extraction() {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Example", confidence: 0.9 },
    title: { value: "Developer", confidence: 0.9 },
    location: { value: null, confidence: 0 },
    workMode: { value: null, confidence: 0 },
    term: { value: null, confidence: 0 },
    deadline: { value: null, confidence: 0 },
    namedSkills: { value: ["TypeScript", "React"], confidence: 0.9 },
    responsibilities: { value: [], confidence: 0.8 },
    requirements: { value: [], confidence: 0.8 },
    structuredRequirements: {
      requiredSkills: [],
      preferredSkills: [],
      requiredTechnologies: ["TypeScript"],
      preferredTechnologies: ["React"],
      education: [],
      certifications: ["AWS Certified Cloud Practitioner"],
      languages: ["French"],
      workAuthorization: [],
      experience: [],
      responsibilities: [],
      softSkills: ["Communication"],
      keywords: [],
      uncategorizedRequirements: [],
    },
    overallConfidence: 0.88,
  };
}

function profile(
  candidateEvidence: MasterProfileData["candidateEvidence"],
): MasterProfileData {
  return {
    fullName: "Scoped candidate",
    email: "scoped@invalid.example",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: [],
    entries: [],
    candidateEvidence,
  };
}

function payload(
  candidateEvidence: MasterProfileSavePayload["candidateEvidence"],
): MasterProfileSavePayload {
  return {
    fullName: "Scoped candidate",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: [],
    entries: [],
    candidateEvidence,
  };
}

test("profile save is visible to the next owned-job match request without stale data", async () => {
  let activeUserId = OWNER_ID;
  let storedOwnerProfile = profile({
    technologies: ["TypeScript"],
    softSkills: ["Communication"],
    certifications: [],
    languages: [{ language: "English", proficiency: "fluent" }],
  });
  let profileReads = 0;
  const matchPersistenceWrites = 0;

  const dependencies: OwnedJobMatchDependencies = {
    getAuthenticatedUser: async () => ({
      status: "authenticated",
      user: { id: activeUserId, email: "scoped@invalid.example" },
    }),
    getOwnedJob: async ({ jobId, userId }) => ({
      status: "ready",
      job:
        jobId === JOB_ID && userId === OWNER_ID
          ? { id: JOB_ID, extracted: extraction() }
          : null,
    }),
    getOwnedProfile: async ({ userId }) => {
      profileReads += 1;
      return userId === OWNER_ID
        ? { status: "ready", profile: structuredClone(storedOwnerProfile) }
        : { status: "missing" };
    },
    parseExtraction: parseJobExtractionOutput,
    match: matchResumeToJob,
  };
  const coordinate = createOwnedJobMatchCoordinator(dependencies);

  const initial = await coordinate(JOB_ID);
  assert.equal(initial.status, "matched");
  if (initial.status !== "matched") return;
  assert.deepEqual(
    initial.match.required.matchedItems.map((item) => item.requirement),
    ["TypeScript"],
  );
  assert.deepEqual(
    initial.match.preferred.notEvidencedItems.map((item) => item.requirement),
    ["React"],
  );
  assert.deepEqual(
    initial.match.softSkills.matchedItems.map((item) => item.requirement),
    ["Communication"],
  );
  assert.deepEqual(
    initial.match.certifications.notEvidencedItems.map(
      (item) => item.requirement,
    ),
    ["AWS Certified Cloud Practitioner"],
  );
  assert.deepEqual(
    initial.match.languages.notEvidencedItems.map((item) => item.requirement),
    ["French"],
  );

  const validEdit = validateMasterProfilePayload(
    payload({
      technologies: ["TypeScript", "React"],
      softSkills: ["Communication"],
      certifications: ["AWS Certified Cloud Practitioner"],
      languages: [
        { language: "English", proficiency: "fluent" },
        { language: "French", proficiency: "basic" },
      ],
    }),
  );
  assert.equal(validEdit.ok, true);
  if (!validEdit.ok) return;
  storedOwnerProfile = {
    ...storedOwnerProfile,
    ...validEdit.data,
    email: storedOwnerProfile.email,
  };

  const updated = await coordinate(JOB_ID);
  assert.equal(updated.status, "matched");
  if (updated.status !== "matched") return;
  assert.equal(profileReads, 2);
  assert.deepEqual(
    updated.match.required.matchedItems.map((item) => item.requirement),
    ["TypeScript"],
  );
  assert.deepEqual(
    updated.match.preferred.matchedItems.map((item) => item.requirement),
    ["React"],
  );
  assert.deepEqual(
    updated.match.softSkills.matchedItems.map((item) => item.requirement),
    ["Communication"],
  );
  assert.deepEqual(
    updated.match.certifications.matchedItems.map((item) => item.requirement),
    ["AWS Certified Cloud Practitioner"],
  );
  assert.deepEqual(
    updated.match.languages.matchedItems.map((item) => item.requirement),
    ["French"],
  );
  assert.equal("overallScore" in updated.match, false);

  const persistedBeforeInvalidSave = structuredClone(storedOwnerProfile);
  const invalidEdit = validateMasterProfilePayload({
    ...payload(storedOwnerProfile.candidateEvidence),
    candidateEvidence: {
      ...storedOwnerProfile.candidateEvidence,
      languages: [{ language: "French", proficiency: "expert" }],
    },
  });
  assert.equal(invalidEdit.ok, false);
  assert.deepEqual(storedOwnerProfile, persistedBeforeInvalidSave);

  const afterFailedSave = await coordinate(JOB_ID);
  assert.equal(afterFailedSave.status, "matched");
  if (afterFailedSave.status !== "matched") return;
  assert.equal(afterFailedSave.match.languages.matchedCount, 1);

  activeUserId = SECOND_USER_ID;
  const foreign = await coordinate(JOB_ID);
  assert.deepEqual(foreign, { status: "not_found" });
  assert.equal(profileReads, 3, "foreign job denial occurs before profile load");
  assert.deepEqual(storedOwnerProfile, persistedBeforeInvalidSave);
  assert.equal(matchPersistenceWrites, 0);
  assert.doesNotMatch(
    JSON.stringify(updated),
    /scoped@invalid\.example|raw profile prose|raw extraction/i,
  );
});

test("profile save revalidates its page while match loaders remain request-bound and uncached", () => {
  const actionSource = readFileSync(
    "app/(app)/resumes/master/actions.ts",
    "utf8",
  );
  const profileQuerySource = readFileSync(
    "lib/master-profile/queries.ts",
    "utf8",
  );
  const jobQuerySource = readFileSync("lib/jobs/queries.ts", "utf8");
  const serverClientSource = readFileSync("lib/supabase/server.ts", "utf8");

  assert.match(actionSource, /revalidatePath\("\/resumes\/master"\)/);
  assert.doesNotMatch(profileQuerySource, /unstable_cache|cacheLife|cacheTag/);
  assert.doesNotMatch(jobQuerySource, /unstable_cache|cacheLife|cacheTag/);
  assert.match(profileQuerySource, /await createSupabaseServerClient\(\)/);
  assert.match(jobQuerySource, /await createSupabaseServerClient\(\)/);
  assert.match(serverClientSource, /await cookies\(\)/);
});
