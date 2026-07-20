import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JOB_REQUIREMENTS_VERSION,
  type CanonicalJobRequirements,
} from "../../lib/jobs/job-requirement-normalization";
import type { MasterProfileData } from "../../lib/master-profile/types";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";
import { buildTailoringProviderInput } from "../../lib/tailoring/build-tailoring-provider-input";
import {
  TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
} from "../../lib/tailoring/tailoring-provider-contracts";
import {
  buildTailoringPreflight,
  type TailoringPreflightPackage,
} from "../../lib/tailoring/tailoring-preflight";

const PRIVATE_JOB_ID = "6892c5a6-387e-418a-b2c0-7f3561a65889";

function requirements(
  overrides: Partial<CanonicalJobRequirements> = {},
): CanonicalJobRequirements {
  return {
    contractVersion: CANONICAL_JOB_REQUIREMENTS_VERSION,
    requiredSkills: ["TypeScript", "Rust"],
    preferredSkills: ["Node.js"],
    requiredTechnologies: ["React", "Kubernetes"],
    preferredTechnologies: ["PostgreSQL"],
    education: ["Computer Science degree"],
    certifications: ["AWS Certified Cloud Practitioner", "Azure Fundamentals"],
    languages: ["French"],
    workAuthorization: ["Canadian work authorization"],
    experience: ["Two years"],
    responsibilities: ["  Build   reliable products  "],
    softSkills: ["Communication"],
    keywords: ["Git"],
    uncategorizedRequirements: ["Travel"],
    ...overrides,
  };
}

function profile(overrides: Partial<MasterProfileData> = {}): MasterProfileData {
  return {
    fullName: "PRIVATE_IDENTITY",
    email: "PRIVATE_EMAIL@example.invalid",
    school: "PRIVATE_SCHOOL",
    program: "PRIVATE_PROGRAM",
    gradYear: "2027",
    coopTerm: "PRIVATE_TERM",
    workAuthorization: "Canadian work authorization",
    preferredLocations: [],
    targetRoles: [],
    skills: ["TypeScript", "Git"],
    entries: [
      {
        id: "PRIVATE_ENTRY_ID",
        section: "project",
        source: "Confirmed project",
        text: "PRIVATE_CONFIRMED_PROSE",
        skills: ["Node.js"],
        confirmed: true,
        sortOrder: 0,
      },
      {
        id: "PRIVATE_UNCONFIRMED_ID",
        section: "experience",
        source: "PRIVATE_UNCONFIRMED_SOURCE",
        text: "PRIVATE_UNCONFIRMED_PROSE",
        skills: ["Rust"],
        confirmed: false,
        sortOrder: 1,
      },
      {
        id: "PRIVATE_CERTIFICATION_ID",
        section: "certification",
        source: "AWS Certified Cloud Practitioner",
        text: "PRIVATE_CERTIFICATION_PROSE",
        skills: [],
        confirmed: true,
        sortOrder: 2,
      },
    ],
    candidateEvidence: {
      technologies: ["React", "PostgreSQL"],
      softSkills: ["Communication"],
      certifications: ["Azure Fundamentals"],
      languages: [{ language: "French", proficiency: "fluent" }],
    },
    ...overrides,
  };
}

function readyPreflight(
  profileValue = profile(),
  requirementValue = requirements(),
) {
  return buildTailoringPreflight({
    job: {
      id: PRIVATE_JOB_ID,
      title: "  Product   Developer ",
      companyName: " Example Company ",
      location: " Vancouver, BC ",
    },
    requirements: requirementValue,
    profile: profileValue,
    match: matchResumeToJob(requirementValue, profileValue),
  });
}

function successfulInput(preflight = readyPreflight()) {
  const result = buildTailoringProviderInput(preflight);
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("expected success");
  return result.input;
}

test("builds the deterministic versioned provider projection with stable evidence IDs", () => {
  const first = successfulInput();
  const second = successfulInput();

  assert.equal(first.contractVersion, TAILORING_PROVIDER_INPUT_CONTRACT_VERSION);
  assert.deepEqual(second, first);
  assert.deepEqual(
    first.approvedCandidateEvidence.map((item) => item.evidenceId),
    ["ev_001", "ev_002", "ev_003", "ev_004", "ev_005", "ev_006", "ev_007", "ev_008", "ev_009"],
  );
  assert.deepEqual(first.job, {
    title: "Product Developer",
    companyName: "Example Company",
    location: "Vancouver, BC",
  });
  assert.equal("id" in first.job, false);
});

test("preserves category, requirement modality, provenance, labels, and language metadata", () => {
  const input = successfulInput();
  const evidenceByTerm = new Map(
    input.approvedCandidateEvidence.map((item) => [item.term, item]),
  );

  assert.deepEqual(evidenceByTerm.get("TypeScript"), {
    evidenceId: "ev_001",
    category: "general_skill",
    term: "TypeScript",
    sourceType: "top_level_general_skill",
    sourceLabel: "General skills",
  });
  assert.equal(evidenceByTerm.get("Git")?.category, "keyword");
  assert.equal(evidenceByTerm.get("Node.js")?.sourceType, "confirmed_entry_skill");
  assert.equal(evidenceByTerm.get("React")?.sourceType, "explicit_technology");
  assert.equal(evidenceByTerm.get("Communication")?.sourceType, "explicit_soft_skill");
  assert.equal(
    evidenceByTerm.get("AWS Certified Cloud Practitioner")?.sourceType,
    "confirmed_certification_title",
  );
  assert.equal(evidenceByTerm.get("Azure Fundamentals")?.sourceType, "explicit_certification");
  assert.deepEqual(evidenceByTerm.get("French"), {
    evidenceId: "ev_009",
    category: "language",
    term: "French",
    sourceType: "explicit_language",
    sourceLabel: "Languages",
    languageProficiency: "fluent",
  });

  const matchedByCategory = new Map(
    input.jobContext.matchedRequirements.map((item) => [item.category, item]),
  );
  assert.equal(matchedByCategory.get("required_skill")?.modality, "required");
  assert.equal(matchedByCategory.get("preferred_skill")?.modality, "preferred");
  assert.equal(matchedByCategory.get("required_technology")?.evidenceId, "ev_005");
  assert.equal(matchedByCategory.get("preferred_technology")?.evidenceId, "ev_006");
  assert.equal(matchedByCategory.get("soft_skill")?.modality, "non_modal");
});

test("keeps limitations, responsibilities, and work authorization context-only", () => {
  const input = successfulInput();

  assert.equal(input.jobContext.responsibilities.length, 1);
  assert.match(input.jobContext.responsibilities[0].contextId, /^ctx_\d{3}$/);
  assert.equal(
    input.jobContext.responsibilities[0].responsibility,
    "Build reliable products",
  );
  assert.ok(input.jobContext.notEvidencedRequirements.length > 0);
  assert.ok(input.jobContext.unassessed.total > 0);
  assert.equal(input.jobContext.workAuthorization.status, "exact_match");
  const evidenceTerms = new Set(
    input.approvedCandidateEvidence.map((item) => item.term),
  );
  assert.equal(evidenceTerms.has("Two years"), false);
  assert.equal(evidenceTerms.has("Computer Science degree"), false);
  assert.equal(evidenceTerms.has("Build reliable products"), false);
  assert.equal(evidenceTerms.has("Canadian work authorization"), false);
});

test("excludes identity, storage, raw prose, extraction, resume, and credit data", () => {
  const serialized = JSON.stringify(successfulInput());

  assert.doesNotMatch(
    serialized,
    /PRIVATE_(IDENTITY|EMAIL|SCHOOL|PROGRAM|TERM|ENTRY_ID|UNCONFIRMED|CONFIRMED_PROSE|CERTIFICATION_ID|CERTIFICATION_PROSE)/,
  );
  assert.doesNotMatch(
    serialized,
    /raw_text|rawText|extracted|resumeVersion|tailored|generated|credit|balance|reservation/i,
  );
  assert.doesNotMatch(serialized, new RegExp(PRIVATE_JOB_ID));
});

test("supplies the canonical immutable prohibited-claim list without a caller override", () => {
  const input = successfulInput();

  assert.deepEqual(
    input.prohibitedClaimCategories,
    TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  );
  assert.equal(Object.isFrozen(input), true);
  assert.equal(Object.isFrozen(input.prohibitedClaimCategories), true);
  assert.equal("prohibitedClaims" in readyPreflight(), false);
});

test("rejects non-ready preflight packages without constructing an empty projection", () => {
  for (const readiness of [
    "insufficient_job_data",
    "insufficient_candidate_data",
  ] as const) {
    const preflight = { ...readyPreflight(), readiness };
    assert.deepEqual(buildTailoringProviderInput(preflight), {
      status: "not_ready",
      readiness,
    });
  }

  assert.deepEqual(
    buildTailoringProviderInput({
      ...readyPreflight(),
      contractVersion: "wrong-contract",
    } as unknown as TailoringPreflightPackage),
    { status: "invalid_preflight" },
  );
});

test("deduplicates category-identical evidence while preserving first-seen spelling and provenance", () => {
  const input = successfulInput(
    readyPreflight(
      profile({
        skills: ["TypeScript", " typescript "],
        entries: [
          {
            id: "PRIVATE_DUPLICATE_ID",
            section: "project",
            source: "Later source",
            text: "PRIVATE_DUPLICATE_PROSE",
            skills: ["TYPESCRIPT"],
            confirmed: true,
            sortOrder: 0,
          },
        ],
        candidateEvidence: undefined,
      }),
      requirements({
        preferredSkills: [],
        requiredTechnologies: [],
        preferredTechnologies: [],
        certifications: [],
        languages: [],
        softSkills: [],
        keywords: [],
      }),
    ),
  );

  assert.deepEqual(input.approvedCandidateEvidence, [
    {
      evidenceId: "ev_001",
      category: "general_skill",
      term: "TypeScript",
      sourceType: "top_level_general_skill",
      sourceLabel: "General skills",
    },
  ]);
});

test("preserves legacy technology-fallback provenance", () => {
  const profileValue = profile({
    skills: ["TypeScript"],
    entries: [],
    candidateEvidence: undefined,
  });
  const requirementValue = requirements({
    requiredSkills: [],
    preferredSkills: [],
    requiredTechnologies: ["TypeScript"],
    preferredTechnologies: [],
    certifications: [],
    languages: [],
    softSkills: [],
    keywords: [],
  });
  const input = successfulInput(readyPreflight(profileValue, requirementValue));

  assert.deepEqual(input.approvedCandidateEvidence, [
    {
      evidenceId: "ev_001",
      category: "technology",
      term: "TypeScript",
      sourceType: "legacy_technology_fallback",
      sourceLabel: "General skills (legacy technology fallback)",
    },
  ]);
});

test("does not mutate the preflight and has no database, provider, or network dependency", () => {
  const preflight = readyPreflight();
  const before = structuredClone(preflight);
  const result = buildTailoringProviderInput(preflight);

  assert.equal(result.status, "success");
  assert.deepEqual(preflight, before);
  assert.equal(buildTailoringProviderInput.length, 1);
  assert.equal(buildTailoringProviderInput.constructor.name, "Function");
});

test("rejects unsafe oversized preflight strings instead of truncating or leaking them", () => {
  const preflight = readyPreflight();
  assert.deepEqual(
    buildTailoringProviderInput({
      ...preflight,
      job: { ...preflight.job, title: "x".repeat(201) },
    }),
    { status: "invalid_preflight" },
  );
});
