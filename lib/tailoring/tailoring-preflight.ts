import type { CanonicalJobRequirements } from "@/lib/jobs/job-requirement-normalization";
import {
  parseCandidateEvidence,
  type CandidateLanguageProficiency,
} from "@/lib/master-profile/candidate-evidence";
import type {
  MasterProfileData,
  MasterProfileSection,
} from "@/lib/master-profile/types";
import type {
  ComparableRequirementCategory,
  RequirementCoverageGroup,
  ResumeJobExactMatchResult,
  WorkAuthorizationMatch,
} from "@/lib/matching/resume-job-match";

export const TAILORING_PREFLIGHT_CONTRACT_VERSION =
  "tailoring-preflight-v1" as const;

export const TAILORING_SAFETY_PROHIBITIONS = Object.freeze([
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
] as const);

export type TailoringPreflightReadiness =
  | "ready"
  | "insufficient_job_data"
  | "insufficient_candidate_data";

export type TailoringEvidenceSourceType =
  | "top_level_general_skill"
  | "confirmed_entry_skill"
  | "explicit_technology"
  | "legacy_technology_fallback"
  | "explicit_soft_skill"
  | "explicit_certification"
  | "confirmed_certification_title"
  | "explicit_language";

export type TailoringMatchedEvidence = Readonly<{
  requirement: string;
  matchedCandidateTerm: string;
}>;

export type TailoringNotEvidencedRequirement = Readonly<{
  category: ComparableRequirementCategory;
  requirement: string;
}>;

export type TailoringSupportingEvidenceReference = Readonly<{
  sourceType: TailoringEvidenceSourceType;
  displayTitle: string;
  profileSection?: MasterProfileSection;
  matchedTerms: readonly string[];
  languageProficiency?: CandidateLanguageProficiency;
}>;

export type TailoringPreflightPackage = Readonly<{
  contractVersion: typeof TAILORING_PREFLIGHT_CONTRACT_VERSION;
  readiness: TailoringPreflightReadiness;
  job: Readonly<{
    id: string;
    title: string;
    companyName: string;
    location?: string;
  }>;
  matched: Readonly<{
    requiredSkills: readonly TailoringMatchedEvidence[];
    preferredSkills: readonly TailoringMatchedEvidence[];
    requiredTechnologies: readonly TailoringMatchedEvidence[];
    preferredTechnologies: readonly TailoringMatchedEvidence[];
    softSkills: readonly TailoringMatchedEvidence[];
    certifications: readonly TailoringMatchedEvidence[];
    languages: readonly TailoringMatchedEvidence[];
    keywords: readonly TailoringMatchedEvidence[];
  }>;
  workAuthorization: WorkAuthorizationMatch;
  supportingEvidence: readonly TailoringSupportingEvidenceReference[];
  jobContext: Readonly<{
    responsibilities: readonly string[];
  }>;
  notEvidenced: readonly TailoringNotEvidencedRequirement[];
  unassessed: Readonly<{
    total: number;
    categories: readonly Readonly<{ category: string; count: number }>[];
  }>;
  safetyProhibitions: typeof TAILORING_SAFETY_PROHIBITIONS;
}>;

export type BuildTailoringPreflightInput = Readonly<{
  job: Readonly<{
    id: string;
    title?: string;
    companyName?: string | null;
    location?: string | null;
  }>;
  requirements: CanonicalJobRequirements;
  profile: MasterProfileData;
  match: ResumeJobExactMatchResult;
}>;

function normalizeTerm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function comparisonKey(value: string) {
  return value.toLocaleLowerCase("en-CA");
}

function normalizedUniqueTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const term = normalizeTerm(item);
    if (!term) continue;
    const key = comparisonKey(term);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }

  return result;
}

function matchedForCategory(
  group: RequirementCoverageGroup,
  category: ComparableRequirementCategory,
): TailoringMatchedEvidence[] {
  return group.matchedItems
    .filter((item) => item.category === category)
    .map((item) => ({
      requirement: item.requirement,
      matchedCandidateTerm: item.matchedCandidateTerm,
    }));
}

function matchedKeysFor(
  groups: readonly RequirementCoverageGroup[],
  categories: ReadonlySet<ComparableRequirementCategory>,
) {
  return new Set(
    groups
      .flatMap((group) => group.matchedItems)
      .filter((item) => categories.has(item.category))
      .map((item) => comparisonKey(item.matchedCandidateTerm)),
  );
}

function matchedTermsFrom(
  sourceTerms: unknown,
  matchedKeys: ReadonlySet<string>,
) {
  return normalizedUniqueTerms(sourceTerms).filter((term) =>
    matchedKeys.has(comparisonKey(term)),
  );
}

function supportingEvidence(
  profile: MasterProfileData,
  match: ResumeJobExactMatchResult,
): TailoringSupportingEvidenceReference[] {
  const generalMatchedKeys = matchedKeysFor(
    [match.required, match.preferred, match.keywords],
    new Set(["required_skill", "preferred_skill", "keyword"]),
  );
  const technologyMatchedKeys = matchedKeysFor(
    [match.required, match.preferred],
    new Set(["required_technology", "preferred_technology"]),
  );
  const softSkillMatchedKeys = matchedKeysFor(
    [match.softSkills],
    new Set(["soft_skill"]),
  );
  const certificationMatchedKeys = matchedKeysFor(
    [match.certifications],
    new Set(["certification"]),
  );
  const languageMatchedKeys = matchedKeysFor(
    [match.languages],
    new Set(["language"]),
  );
  const references: TailoringSupportingEvidenceReference[] = [];
  const profileValue = profile as unknown as Record<string, unknown>;
  const entries = Array.isArray(profileValue.entries)
    ? profileValue.entries
    : [];
  const topLevelTerms = matchedTermsFrom(
    profileValue.skills,
    generalMatchedKeys,
  );

  if (topLevelTerms.length > 0) {
    references.push({
      sourceType: "top_level_general_skill",
      displayTitle: "General skills",
      matchedTerms: topLevelTerms,
    });
  }

  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      entry.confirmed !== true
    ) {
      continue;
    }

    const entryTerms = matchedTermsFrom(entry.skills, generalMatchedKeys);
    const displayTitle = normalizeTerm(entry.source) ?? "Confirmed profile entry";
    const section = entry.section as MasterProfileSection;
    if (entryTerms.length > 0) {
      references.push({
        sourceType: "confirmed_entry_skill",
        displayTitle,
        profileSection: section,
        matchedTerms: entryTerms,
      });
    }

    const certificationTitle = normalizeTerm(entry.source);
    if (
      section === "certification" &&
      certificationTitle &&
      certificationMatchedKeys.has(comparisonKey(certificationTitle))
    ) {
      references.push({
        sourceType: "confirmed_certification_title",
        displayTitle,
        profileSection: section,
        matchedTerms: [certificationTitle],
      });
    }
  }

  const parsedEvidence = parseCandidateEvidence(profileValue.candidateEvidence);
  const generalTechnologyTerms = normalizedUniqueTerms([
    ...normalizedUniqueTerms(profileValue.skills),
    ...entries.flatMap((entry) =>
      typeof entry === "object" &&
      entry !== null &&
      !Array.isArray(entry) &&
      entry.confirmed === true
        ? normalizedUniqueTerms(entry.skills)
        : [],
    ),
  ]);
  if (
    parsedEvidence.status === "absent" ||
    (parsedEvidence.status === "valid" &&
      parsedEvidence.evidence.technologies === undefined)
  ) {
    const legacyTerms = generalTechnologyTerms.filter((term) =>
      technologyMatchedKeys.has(comparisonKey(term)),
    );
    if (legacyTerms.length > 0) {
      references.push({
        sourceType: "legacy_technology_fallback",
        displayTitle: "General skills (legacy technology fallback)",
        matchedTerms: legacyTerms,
      });
    }
  }

  if (parsedEvidence.status === "valid") {
    const evidence = parsedEvidence.evidence;
    const explicitSources: ReadonlyArray<{
      sourceType: TailoringEvidenceSourceType;
      displayTitle: string;
      values: unknown;
      matchedKeys: ReadonlySet<string>;
    }> = [
      {
        sourceType: "explicit_technology",
        displayTitle: "Technologies",
        values: evidence.technologies,
        matchedKeys: technologyMatchedKeys,
      },
      {
        sourceType: "explicit_soft_skill",
        displayTitle: "Soft skills",
        values: evidence.softSkills,
        matchedKeys: softSkillMatchedKeys,
      },
      {
        sourceType: "explicit_certification",
        displayTitle: "Certifications",
        values: evidence.certifications,
        matchedKeys: certificationMatchedKeys,
      },
    ];

    for (const source of explicitSources) {
      const terms = matchedTermsFrom(source.values, source.matchedKeys);
      if (terms.length > 0) {
        references.push({
          sourceType: source.sourceType,
          displayTitle: source.displayTitle,
          matchedTerms: terms,
        });
      }
    }

    for (const language of evidence.languages ?? []) {
      const languageName = normalizeTerm(language.language);
      if (
        !languageName ||
        !languageMatchedKeys.has(comparisonKey(languageName))
      ) {
        continue;
      }
      references.push({
        sourceType: "explicit_language",
        displayTitle: "Languages",
        matchedTerms: [languageName],
        ...(language.proficiency
          ? { languageProficiency: language.proficiency }
          : {}),
      });
    }
  }

  return references;
}

function notEvidenced(match: ResumeJobExactMatchResult) {
  return [
    match.required,
    match.preferred,
    match.softSkills,
    match.certifications,
    match.languages,
    match.keywords,
  ].flatMap((group) =>
    group.notEvidencedItems.map((item) => ({
      category: item.category,
      requirement: item.requirement,
    })),
  );
}

function unassessed(match: ResumeJobExactMatchResult) {
  const counts = new Map<string, number>();
  for (const item of match.unassessedRequirements) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return {
    total: match.unassessedRequirements.length,
    categories: [...counts.entries()].map(([category, count]) => ({
      category,
      count,
    })),
  };
}

export function buildTailoringPreflight(
  input: BuildTailoringPreflightInput,
): TailoringPreflightPackage {
  const title = normalizeTerm(input.job.title) ?? "Private job";
  const companyName =
    normalizeTerm(input.job.companyName) ?? "Company not listed";
  const location = normalizeTerm(input.job.location);
  const readiness: TailoringPreflightReadiness =
    input.match.status === "comparable" ? "ready" : input.match.status;

  return {
    contractVersion: TAILORING_PREFLIGHT_CONTRACT_VERSION,
    readiness,
    job: {
      id: input.job.id,
      title,
      companyName,
      ...(location ? { location } : {}),
    },
    matched: {
      requiredSkills: matchedForCategory(
        input.match.required,
        "required_skill",
      ),
      preferredSkills: matchedForCategory(
        input.match.preferred,
        "preferred_skill",
      ),
      requiredTechnologies: matchedForCategory(
        input.match.required,
        "required_technology",
      ),
      preferredTechnologies: matchedForCategory(
        input.match.preferred,
        "preferred_technology",
      ),
      softSkills: matchedForCategory(input.match.softSkills, "soft_skill"),
      certifications: matchedForCategory(
        input.match.certifications,
        "certification",
      ),
      languages: matchedForCategory(input.match.languages, "language"),
      keywords: matchedForCategory(input.match.keywords, "keyword"),
    },
    workAuthorization: input.match.workAuthorization,
    supportingEvidence: supportingEvidence(input.profile, input.match),
    jobContext: {
      responsibilities: normalizedUniqueTerms(input.requirements.responsibilities),
    },
    notEvidenced: notEvidenced(input.match),
    unassessed: unassessed(input.match),
    safetyProhibitions: TAILORING_SAFETY_PROHIBITIONS,
  };
}
