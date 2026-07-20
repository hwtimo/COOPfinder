import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JOB_REQUIREMENTS_VERSION,
  type CanonicalJobRequirements,
} from "../../lib/jobs/job-requirement-normalization";
import type { MasterProfileData } from "../../lib/master-profile/types";
import { matchResumeToJob } from "../../lib/matching/resume-job-match";
import {
  buildTailoringPreflight,
  TAILORING_PREFLIGHT_CONTRACT_VERSION,
  TAILORING_SAFETY_PROHIBITIONS,
} from "../../lib/tailoring/tailoring-preflight";

const JOB_ID = "6892c5a6-387e-418a-b2c0-7f3561a65889";

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
    certifications: [
      "AWS Certified Cloud Practitioner",
      "Azure Fundamentals",
      "Google Cloud certification",
    ],
    languages: ["French", "German"],
    workAuthorization: ["Canadian work authorization"],
    experience: ["Two years of development experience"],
    responsibilities: ["Build reliable product features"],
    softSkills: ["Communication", "Leadership"],
    keywords: ["Git", "Rust"],
    uncategorizedRequirements: ["Occasional travel"],
    ...overrides,
  };
}

function profile(overrides: Partial<MasterProfileData> = {}): MasterProfileData {
  return {
    fullName: "PRIVATE_IDENTITY",
    email: "PRIVATE_EMAIL@example.invalid",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
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
        id: "PRIVATE_CERT_ID",
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

function build(
  profileValue = profile(),
  requirementsValue = requirements(),
) {
  return buildTailoringPreflight({
    job: {
      id: JOB_ID,
      title: "  Product   Developer ",
      companyName: " Example Company ",
      location: " Vancouver, BC ",
    },
    requirements: requirementsValue,
    profile: profileValue,
    match: matchResumeToJob(requirementsValue, profileValue),
  });
}

test("builds a deterministic versioned package with safe metadata and categorized matches", () => {
  const first = build();
  const second = build();

  assert.deepEqual(second, first);
  assert.equal(first.contractVersion, TAILORING_PREFLIGHT_CONTRACT_VERSION);
  assert.equal(first.readiness, "ready");
  assert.deepEqual(first.job, {
    id: JOB_ID,
    title: "Product Developer",
    companyName: "Example Company",
    location: "Vancouver, BC",
  });
  assert.deepEqual(
    first.matched.requiredSkills.map((item) => item.requirement),
    ["TypeScript"],
  );
  assert.deepEqual(
    first.matched.preferredSkills.map((item) => item.requirement),
    ["Node.js"],
  );
  assert.deepEqual(
    first.matched.requiredTechnologies.map((item) => item.requirement),
    ["React"],
  );
  assert.deepEqual(
    first.matched.preferredTechnologies.map((item) => item.requirement),
    ["PostgreSQL"],
  );
  assert.deepEqual(
    first.matched.softSkills.map((item) => item.requirement),
    ["Communication"],
  );
  assert.deepEqual(
    first.matched.certifications.map((item) => item.requirement),
    ["AWS Certified Cloud Practitioner", "Azure Fundamentals"],
  );
  assert.deepEqual(
    first.matched.languages.map((item) => item.requirement),
    ["French"],
  );
  assert.deepEqual(
    first.matched.keywords.map((item) => item.requirement),
    ["Git"],
  );
  assert.equal(first.workAuthorization.status, "exact_match");
  assert.equal("overallScore" in first, false);
});

test("retains limitations and compact unassessed counts without promoting them to claims", () => {
  const result = build();

  assert.deepEqual(
    result.notEvidenced.map((item) => item.requirement),
    [
      "Rust",
      "Kubernetes",
      "Leadership",
      "Google Cloud certification",
      "German",
      "Rust",
    ],
  );
  assert.deepEqual(result.jobContext.responsibilities, [
    "Build reliable product features",
  ]);
  assert.equal(result.unassessed.total, 4);
  assert.deepEqual(result.unassessed.categories, [
    { category: "education", count: 1 },
    { category: "experience", count: 1 },
    { category: "responsibility", count: 1 },
    { category: "uncategorized_requirement", count: 1 },
  ]);
  assert.equal(
    Object.values(result.matched)
      .flat()
      .some((item) => item.requirement === "Rust"),
    false,
  );
});

test("records narrow provenance and excludes unconfirmed entries and all prose", () => {
  const result = build();
  const byType = new Map(
    result.supportingEvidence.map((reference) => [
      reference.sourceType,
      reference,
    ]),
  );

  assert.deepEqual(byType.get("top_level_general_skill")?.matchedTerms, [
    "TypeScript",
    "Git",
  ]);
  assert.deepEqual(byType.get("confirmed_entry_skill"), {
    sourceType: "confirmed_entry_skill",
    displayTitle: "Confirmed project",
    profileSection: "project",
    matchedTerms: ["Node.js"],
  });
  assert.deepEqual(byType.get("explicit_technology")?.matchedTerms, [
    "React",
    "PostgreSQL",
  ]);
  assert.deepEqual(byType.get("explicit_soft_skill")?.matchedTerms, [
    "Communication",
  ]);
  assert.deepEqual(byType.get("explicit_certification")?.matchedTerms, [
    "Azure Fundamentals",
  ]);
  assert.deepEqual(
    byType.get("confirmed_certification_title")?.matchedTerms,
    ["AWS Certified Cloud Practitioner"],
  );
  assert.deepEqual(byType.get("explicit_language"), {
    sourceType: "explicit_language",
    displayTitle: "Languages",
    matchedTerms: ["French"],
    languageProficiency: "fluent",
  });

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(
    serialized,
    /PRIVATE_(IDENTITY|EMAIL|ENTRY_ID|UNCONFIRMED|CONFIRMED_PROSE|CERTIFICATION_PROSE|CERT_ID)/,
  );
  assert.doesNotMatch(
    serialized,
    /raw_text|rawText|extracted|resumeVersion|tailored|generated/i,
  );
});

test("keeps supporting provenance within the evidence category that satisfied the match", () => {
  const result = build(
    profile({
      skills: ["TypeScript", "React", "French", "Communication"],
      entries: [],
      candidateEvidence: {
        technologies: ["React"],
        softSkills: ["Communication"],
        certifications: [],
        languages: [{ language: "French", proficiency: "professional" }],
      },
    }),
    requirements({
      requiredSkills: ["TypeScript"],
      preferredSkills: [],
      requiredTechnologies: ["React"],
      preferredTechnologies: [],
      certifications: [],
      languages: ["French"],
      softSkills: ["Communication"],
      keywords: [],
      education: [],
      experience: [],
      responsibilities: [],
      uncategorizedRequirements: [],
      workAuthorization: [],
    }),
  );
  const byType = new Map(
    result.supportingEvidence.map((reference) => [
      reference.sourceType,
      reference.matchedTerms,
    ]),
  );

  assert.deepEqual(byType.get("top_level_general_skill"), ["TypeScript"]);
  assert.deepEqual(byType.get("explicit_technology"), ["React"]);
  assert.deepEqual(byType.get("explicit_soft_skill"), ["Communication"]);
  assert.deepEqual(byType.get("explicit_language"), ["French"]);
});

test("identifies legacy technology fallback while explicit empty technologies disable it", () => {
  const jobRequirements = requirements({
    requiredSkills: [],
    preferredSkills: [],
    requiredTechnologies: ["TypeScript"],
    preferredTechnologies: [],
    certifications: [],
    languages: [],
    softSkills: [],
    keywords: [],
    education: [],
    experience: [],
    responsibilities: [],
    uncategorizedRequirements: [],
    workAuthorization: [],
  });
  const legacyProfile = profile({ candidateEvidence: undefined, entries: [] });
  const legacy = build(legacyProfile, jobRequirements);

  assert.equal(legacy.matched.requiredTechnologies.length, 1);
  assert.deepEqual(
    legacy.supportingEvidence.find(
      (reference) => reference.sourceType === "legacy_technology_fallback",
    )?.matchedTerms,
    ["TypeScript"],
  );

  const curatedEmpty = build(
    profile({ candidateEvidence: { technologies: [] }, entries: [] }),
    jobRequirements,
  );
  assert.equal(curatedEmpty.matched.requiredTechnologies.length, 0);
  assert.equal(
    curatedEmpty.supportingEvidence.some(
      (reference) => reference.sourceType === "legacy_technology_fallback",
    ),
    false,
  );
});

test("preserves insufficient states and legacy profile compatibility", () => {
  const emptyRequirements = requirements({
    requiredSkills: [],
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
  });
  assert.equal(build(profile(), emptyRequirements).readiness, "insufficient_job_data");

  const emptyProfile = profile({
    skills: [],
    entries: [],
    workAuthorization: "",
    candidateEvidence: undefined,
  });
  assert.equal(
    build(emptyProfile, requirements({ workAuthorization: [] })).readiness,
    "insufficient_candidate_data",
  );
});

test("includes the fixed immutable safety prohibitions without mutating inputs", () => {
  const profileValue = profile();
  const requirementsValue = requirements();
  const profileBefore = structuredClone(profileValue);
  const requirementsBefore = structuredClone(requirementsValue);
  const result = build(profileValue, requirementsValue);

  assert.equal(result.safetyProhibitions, TAILORING_SAFETY_PROHIBITIONS);
  assert.equal(Object.isFrozen(result.safetyProhibitions), true);
  assert.deepEqual(profileValue, profileBefore);
  assert.deepEqual(requirementsValue, requirementsBefore);
  assert.deepEqual(result.safetyProhibitions, [
    "unsupported employers",
    "unsupported job titles",
    "unsupported dates",
    "unsupported durations",
    "unsupported metrics",
    "unsupported education",
    "unsupported experience",
    "unsupported skills",
    "unsupported technologies",
    "unsupported certifications",
    "unsupported languages",
    "unsupported work authorization",
    "unsupported projects",
    "unsupported responsibilities or achievements",
  ]);
});
