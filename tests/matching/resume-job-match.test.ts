import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JOB_REQUIREMENTS_VERSION,
  type CanonicalJobRequirements,
} from "../../lib/jobs/job-requirement-normalization";
import type { MasterProfileData } from "../../lib/master-profile/types";
import {
  matchResumeToJob,
  RESUME_JOB_EXACT_MATCH_VERSION,
} from "../../lib/matching/resume-job-match";

function requirements(
  overrides: Partial<CanonicalJobRequirements> = {},
): CanonicalJobRequirements {
  return {
    contractVersion: CANONICAL_JOB_REQUIREMENTS_VERSION,
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
    ...overrides,
  };
}

function profile(overrides: Partial<MasterProfileData> = {}): MasterProfileData {
  return {
    fullName: "",
    email: "",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: [],
    entries: [],
    ...overrides,
  };
}

function entry(
  skills: string[],
  confirmed: boolean,
): MasterProfileData["entries"][number] {
  return {
    id: `entry-${confirmed}-${skills.join("-")}`,
    section: "experience",
    source: "Entry",
    text: "Raw prose must not be matched.",
    skills,
    confirmed,
    sortOrder: 0,
  };
}

test("matches exact required skills and technologies while preserving categories", () => {
  const result = matchResumeToJob(
    requirements({
      requiredSkills: ["TypeScript"],
      requiredTechnologies: ["PostgreSQL"],
    }),
    profile({ skills: ["TypeScript", "PostgreSQL"] }),
  );

  assert.equal(result.contractVersion, RESUME_JOB_EXACT_MATCH_VERSION);
  assert.equal(result.status, "comparable");
  assert.equal(result.required.totalUniqueRequirements, 2);
  assert.equal(result.required.matchedCount, 2);
  assert.equal(result.required.coveragePercentage, 100);
  assert.deepEqual(
    result.required.matchedItems.map((item) => item.category),
    ["required_skill", "required_technology"],
  );
});

test("matches case-insensitively with collapsed whitespace and preserves first spelling", () => {
  const result = matchResumeToJob(
    requirements({ requiredSkills: ["  Data   Analysis "] }),
    profile({ skills: ["data analysis", "DATA   ANALYSIS"] }),
  );

  assert.deepEqual(result.required.matchedItems, [
    {
      category: "required_skill",
      requirement: "Data Analysis",
      matchedCandidateTerm: "data analysis",
    },
  ]);
  assert.equal(result.dataCompleteness.uniqueCandidateTerms, 1);
});

test("keeps required, preferred, and keyword coverage independent", () => {
  const result = matchResumeToJob(
    requirements({
      requiredSkills: ["React"],
      preferredSkills: ["Communication"],
      keywords: ["React", "Git"],
    }),
    profile({ skills: ["React", "Git"] }),
  );

  assert.equal(result.required.coveragePercentage, 100);
  assert.equal(result.preferred.coveragePercentage, 0);
  assert.equal(result.keywords.coveragePercentage, 100);
  assert.equal(result.required.totalUniqueRequirements, 1);
  assert.equal(result.keywords.totalUniqueRequirements, 2);
});

test("reports required items as not evidenced without claiming candidate absence", () => {
  const result = matchResumeToJob(
    requirements({ requiredSkills: ["React", "Rust"] }),
    profile({ skills: ["React"] }),
  );

  assert.equal(result.required.coveragePercentage, 50);
  assert.deepEqual(result.required.notEvidencedItems, [
    { category: "required_skill", requirement: "Rust" },
  ]);
});

test("deduplicates candidate and job terms without numerator or denominator inflation", () => {
  const malformedRequirements = requirements({
    requiredSkills: ["TypeScript", " typescript ", "React"] as never,
  });
  const malformedProfile = profile({
    skills: ["TypeScript", "TYPESCRIPT", " React "] as never,
  });
  const result = matchResumeToJob(malformedRequirements, malformedProfile);

  assert.equal(result.required.totalUniqueRequirements, 2);
  assert.equal(result.required.matchedCount, 2);
  assert.equal(result.dataCompleteness.uniqueCandidateTerms, 2);
});

test("returns insufficient job data and null percentages for empty requirements", () => {
  const result = matchResumeToJob(requirements(), profile({ skills: ["React"] }));

  assert.equal(result.status, "insufficient_job_data");
  assert.equal(result.required.coveragePercentage, null);
  assert.equal(result.preferred.coveragePercentage, null);
  assert.equal(result.keywords.coveragePercentage, null);
});

test("returns insufficient candidate data and zero coverage for an empty profile", () => {
  const result = matchResumeToJob(
    requirements({ requiredSkills: ["React"] }),
    profile(),
  );

  assert.equal(result.status, "insufficient_candidate_data");
  assert.equal(result.required.coveragePercentage, 0);
  assert.equal(result.required.notEvidencedItems.length, 1);
});

test("includes confirmed entry skills after top-level skills and excludes unconfirmed skills", () => {
  const result = matchResumeToJob(
    requirements({ requiredSkills: ["SQL", "React", "Rust"] }),
    profile({
      skills: ["SQL"],
      entries: [entry(["React", "sql"], true), entry(["Rust"], false)],
    }),
  );

  assert.deepEqual(
    result.required.matchedItems.map((item) => item.matchedCandidateTerm),
    ["SQL", "React"],
  );
  assert.deepEqual(result.required.notEvidencedItems, [
    { category: "required_skill", requirement: "Rust" },
  ]);
  assert.equal(result.dataCompleteness.uniqueCandidateTerms, 2);
});

test("supports partial candidate data without reading raw entry prose", () => {
  const result = matchResumeToJob(
    requirements({ requiredSkills: ["Python"] }),
    profile({ entries: [entry([], true)] }),
  );

  assert.equal(result.status, "insufficient_candidate_data");
  assert.equal(result.required.matchedCount, 0);
});

test("keeps keyword-only input comparable without counting keywords as required", () => {
  const result = matchResumeToJob(
    requirements({ keywords: ["TypeScript"] }),
    profile({ skills: ["TypeScript"] }),
  );

  assert.equal(result.status, "comparable");
  assert.equal(result.required.totalUniqueRequirements, 0);
  assert.equal(result.required.coveragePercentage, null);
  assert.equal(result.keywords.matchedCount, 1);
});

test("distinguishes every work-authorization state using exact equality", () => {
  const noRequirement = matchResumeToJob(
    requirements(),
    profile({ workAuthorization: "Domestic students" }),
  );
  const noCandidate = matchResumeToJob(
    requirements({ workAuthorization: ["Domestic students"] }),
    profile(),
  );
  const exact = matchResumeToJob(
    requirements({ workAuthorization: [" domestic   students "] }),
    profile({ workAuthorization: "Domestic students" }),
  );
  const mismatch = matchResumeToJob(
    requirements({ workAuthorization: ["Domestic students"] }),
    profile({ workAuthorization: "International eligible" }),
  );

  assert.equal(noRequirement.workAuthorization.status, "no_job_requirement");
  assert.equal(noCandidate.workAuthorization.status, "no_candidate_value");
  assert.equal(exact.workAuthorization.status, "exact_match");
  assert.equal(mismatch.workAuthorization.status, "mismatch");
  assert.equal(exact.status, "comparable");
});

test("keeps only unsupported requirements unassessed in stable order", () => {
  const result = matchResumeToJob(
    requirements({
      education: ["Degree"],
      certifications: ["AWS"],
      languages: ["French"],
      experience: ["Two years"],
      responsibilities: ["Build APIs"],
      softSkills: ["Communication"],
      uncategorizedRequirements: ["Weekend availability"],
    }),
    profile(),
  );

  assert.deepEqual(
    result.unassessedRequirements.map((item) => item.category),
    [
      "education",
      "experience",
      "responsibility",
      "uncategorized_requirement",
    ],
  );
  assert.equal(result.dataCompleteness.unassessedJobRequirements, 4);
  assert.equal(result.certifications.totalUniqueRequirements, 1);
  assert.equal(result.languages.totalUniqueRequirements, 1);
  assert.equal(result.softSkills.totalUniqueRequirements, 1);
});

test("explicit technologies are authoritative and do not supplement broad skills", () => {
  const result = matchResumeToJob(
    requirements({ requiredTechnologies: ["TypeScript", "PostgreSQL"] }),
    profile({
      skills: ["TypeScript", "PostgreSQL"],
      candidateEvidence: { technologies: ["TypeScript"] },
    }),
  );

  assert.equal(result.required.matchedCount, 1);
  assert.deepEqual(result.required.notEvidencedItems, [
    { category: "required_technology", requirement: "PostgreSQL" },
  ]);
});

test("explicit empty technologies disable fallback while absence preserves it", () => {
  const job = requirements({ requiredTechnologies: ["TypeScript"] });
  const absent = matchResumeToJob(job, profile({ skills: ["TypeScript"] }));
  const explicitEmpty = matchResumeToJob(
    job,
    profile({
      skills: ["TypeScript"],
      candidateEvidence: { technologies: [] },
    }),
  );

  assert.equal(absent.required.matchedCount, 1);
  assert.equal(explicitEmpty.required.matchedCount, 0);
});

test("technology evidence matches only technology requirements", () => {
  const candidate = profile({
    candidateEvidence: { technologies: ["TypeScript"] },
  });
  const skillResult = matchResumeToJob(
    requirements({ requiredSkills: ["TypeScript"] }),
    candidate,
  );
  const technologyResult = matchResumeToJob(
    requirements({ requiredTechnologies: ["TypeScript"] }),
    candidate,
  );

  assert.equal(skillResult.required.matchedCount, 0);
  assert.deepEqual(technologyResult.required.matchedItems, [
    {
      category: "required_technology",
      requirement: "TypeScript",
      matchedCandidateTerm: "TypeScript",
    },
  ]);
});

test("soft skills compare only against explicit soft-skill evidence", () => {
  const result = matchResumeToJob(
    requirements({ softSkills: ["Communication", "Leadership"] }),
    profile({
      skills: ["Leadership"],
      entries: [entry(["Communication"], true)],
      candidateEvidence: { softSkills: ["Communication"] },
    }),
  );

  assert.equal(result.softSkills.matchedCount, 1);
  assert.deepEqual(result.softSkills.notEvidencedItems, [
    { category: "soft_skill", requirement: "Leadership" },
  ]);
});

test("certifications use explicit evidence and confirmed certification titles only", () => {
  const confirmedCertification = {
    ...entry([], true),
    id: "cert-confirmed",
    section: "certification" as const,
    source: "Azure Fundamentals",
    text: "PRIVATE_CERTIFICATION_PROSE",
  };
  const unconfirmedCertification = {
    ...entry([], false),
    id: "cert-unconfirmed",
    section: "certification" as const,
    source: "Google Cloud Associate",
    text: "AWS Certified Developer",
  };
  const result = matchResumeToJob(
    requirements({
      certifications: [
        "AWS Certified Developer",
        "Azure Fundamentals",
        "Google Cloud Associate",
        "PRIVATE_CERTIFICATION_PROSE",
      ],
    }),
    profile({
      candidateEvidence: { certifications: ["AWS Certified Developer"] },
      entries: [confirmedCertification, unconfirmedCertification],
    }),
  );

  assert.equal(result.certifications.matchedCount, 2);
  assert.deepEqual(
    result.certifications.matchedItems.map((item) => item.requirement),
    ["AWS Certified Developer", "Azure Fundamentals"],
  );
  assert.deepEqual(
    result.certifications.notEvidencedItems.map((item) => item.requirement),
    ["Google Cloud Associate", "PRIVATE_CERTIFICATION_PROSE"],
  );
});

test("languages match exact names and ignore proficiency for satisfaction", () => {
  const result = matchResumeToJob(
    requirements({ languages: ["French", "Professional French", "Spanish"] }),
    profile({
      candidateEvidence: {
        languages: [
          { language: " french ", proficiency: "basic" },
          { language: "Spanish", proficiency: "native" },
        ],
      },
    }),
  );

  assert.equal(result.languages.matchedCount, 2);
  assert.deepEqual(result.languages.notEvidencedItems, [
    { category: "language", requirement: "Professional French" },
  ]);
  assert.equal(JSON.stringify(result.languages).includes("basic"), false);
  assert.equal(JSON.stringify(result.languages).includes("native"), false);
});

test("duplicate categorized evidence does not inflate counts or completeness", () => {
  const result = matchResumeToJob(
    requirements({
      softSkills: ["Communication", " communication "],
      certifications: ["AWS", "aws"],
      languages: ["French", "FRENCH"],
    }),
    profile({
      candidateEvidence: {
        softSkills: ["Communication", "COMMUNICATION"],
        certifications: ["AWS", "aws"],
        languages: [{ language: "French" }, { language: "FRENCH" }],
      },
    }),
  );

  assert.equal(result.softSkills.totalUniqueRequirements, 1);
  assert.equal(result.certifications.totalUniqueRequirements, 1);
  assert.equal(result.languages.totalUniqueRequirements, 1);
  assert.equal(result.dataCompleteness.comparableJobTerms, 3);
  assert.equal(result.dataCompleteness.uniqueCandidateTerms, 3);
});

test("additive match result contains no overall score", () => {
  const result = matchResumeToJob(
    requirements({ softSkills: ["Communication"] }),
    profile({ candidateEvidence: { softSkills: ["Communication"] } }),
  );

  assert.equal("overallScore" in result, false);
  assert.equal("matchScore" in result, false);
});

test("tolerates malformed optional arrays and ignores empty or non-string terms", () => {
  const malformedRequirements = {
    ...requirements(),
    requiredSkills: ["React", null, 42, "  "],
    preferredSkills: null,
    keywords: "TypeScript",
    responsibilities: [" Build APIs ", "build APIs", false],
  } as unknown as CanonicalJobRequirements;
  const malformedProfile = {
    ...profile(),
    skills: ["React", null, ""],
    entries: [null, { confirmed: true, skills: "Rust" }],
  } as unknown as MasterProfileData;
  const result = matchResumeToJob(malformedRequirements, malformedProfile);

  assert.equal(result.required.matchedCount, 1);
  assert.equal(result.preferred.totalUniqueRequirements, 0);
  assert.equal(result.keywords.totalUniqueRequirements, 0);
  assert.deepEqual(result.unassessedRequirements, [
    { category: "responsibility", requirement: "Build APIs" },
  ]);
});

test("does not treat punctuation variants or substrings as equivalent", () => {
  const result = matchResumeToJob(
    requirements({ requiredSkills: ["Node.js", "Type"] }),
    profile({ skills: ["Node JS", "TypeScript"] }),
  );

  assert.equal(result.required.matchedCount, 0);
  assert.equal(result.required.coveragePercentage, 0);
});

test("is deterministic, preserves first-seen order, and does not mutate inputs", () => {
  const job = requirements({
    requiredSkills: [" React ", "SQL"],
    preferredTechnologies: [" Docker "],
  });
  const candidate = profile({
    skills: [" react ", "SQL"],
    entries: [entry(["Docker"], true)],
  });
  const jobSnapshot = structuredClone(job);
  const candidateSnapshot = structuredClone(candidate);

  const first = matchResumeToJob(job, candidate);
  const second = matchResumeToJob(job, candidate);

  assert.deepEqual(second, first);
  assert.notEqual(second, first);
  assert.deepEqual(job, jobSnapshot);
  assert.deepEqual(candidate, candidateSnapshot);
  assert.deepEqual(
    first.required.matchedItems.map((item) => item.requirement),
    ["React", "SQL"],
  );
  assert.equal(first.preferred.matchedItems[0]?.matchedCandidateTerm, "Docker");
});
