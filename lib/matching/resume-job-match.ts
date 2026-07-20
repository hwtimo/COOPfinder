import type { CanonicalJobRequirements } from "@/lib/jobs/job-requirement-normalization";
import { parseCandidateEvidence } from "@/lib/master-profile/candidate-evidence";
import type { MasterProfileData } from "@/lib/master-profile/types";

export const RESUME_JOB_EXACT_MATCH_VERSION =
  "resume-job-exact-match-v1" as const;

export type ResumeJobMatchStatus =
  | "comparable"
  | "insufficient_job_data"
  | "insufficient_candidate_data";

export type ComparableRequirementCategory =
  | "required_skill"
  | "required_technology"
  | "preferred_skill"
  | "preferred_technology"
  | "keyword"
  | "soft_skill"
  | "certification"
  | "language";

export type UnassessedRequirementCategory =
  | "education"
  | "experience"
  | "responsibility"
  | "uncategorized_requirement";

export type MatchedRequirementItem = Readonly<{
  category: ComparableRequirementCategory;
  requirement: string;
  matchedCandidateTerm: string;
}>;

export type NotEvidencedRequirementItem = Readonly<{
  category: ComparableRequirementCategory;
  requirement: string;
}>;

export type RequirementCoverageGroup = Readonly<{
  totalUniqueRequirements: number;
  matchedCount: number;
  coveragePercentage: number | null;
  matchedItems: readonly MatchedRequirementItem[];
  notEvidencedItems: readonly NotEvidencedRequirementItem[];
}>;

export type WorkAuthorizationMatch =
  | Readonly<{
      status: "no_job_requirement";
      jobRequirements: readonly string[];
      candidateValue: string | null;
    }>
  | Readonly<{
      status: "no_candidate_value";
      jobRequirements: readonly string[];
      candidateValue: null;
    }>
  | Readonly<{
      status: "exact_match";
      jobRequirements: readonly string[];
      candidateValue: string;
      matchedRequirement: string;
    }>
  | Readonly<{
      status: "mismatch";
      jobRequirements: readonly string[];
      candidateValue: string;
    }>;

export type UnassessedRequirementItem = Readonly<{
  category: UnassessedRequirementCategory;
  requirement: string;
}>;

export type ResumeJobExactMatchResult = Readonly<{
  contractVersion: typeof RESUME_JOB_EXACT_MATCH_VERSION;
  status: ResumeJobMatchStatus;
  required: RequirementCoverageGroup;
  preferred: RequirementCoverageGroup;
  keywords: RequirementCoverageGroup;
  softSkills: RequirementCoverageGroup;
  certifications: RequirementCoverageGroup;
  languages: RequirementCoverageGroup;
  workAuthorization: WorkAuthorizationMatch;
  dataCompleteness: Readonly<{
    uniqueCandidateTerms: number;
    comparableJobTerms: number;
    unassessedJobRequirements: number;
  }>;
  unassessedRequirements: readonly UnassessedRequirementItem[];
}>;

type CategorizedRequirement = Readonly<{
  category: ComparableRequirementCategory;
  requirement: string;
  normalizedKey: string;
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

function candidateTerms(profile: MasterProfileData): string[] {
  const profileValue = profile as unknown as Record<string, unknown>;
  const orderedTerms = [...normalizedUniqueTerms(profileValue.skills)];
  const entries = Array.isArray(profileValue.entries)
    ? profileValue.entries
    : [];

  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      entry.confirmed !== true
    ) {
      continue;
    }
    orderedTerms.push(...normalizedUniqueTerms(entry.skills));
  }

  return normalizedUniqueTerms(orderedTerms);
}

function confirmedCertificationTitles(profile: MasterProfileData): string[] {
  const profileValue = profile as unknown as Record<string, unknown>;
  const entries = Array.isArray(profileValue.entries)
    ? profileValue.entries
    : [];
  const titles: unknown[] = [];

  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      entry.confirmed !== true ||
      entry.section !== "certification"
    ) {
      continue;
    }
    titles.push(entry.source);
  }

  return normalizedUniqueTerms(titles);
}

function categorizedCandidateTerms(profile: MasterProfileData) {
  const profileValue = profile as unknown as Record<string, unknown>;
  const parsed = parseCandidateEvidence(profileValue.candidateEvidence);
  const generalSkills = candidateTerms(profile);

  if (parsed.status !== "valid") {
    return {
      generalSkills,
      technologies:
        parsed.status === "absent" ? generalSkills : ([] as string[]),
      softSkills: [] as string[],
      certifications: confirmedCertificationTitles(profile),
      languages: [] as string[],
    };
  }

  const evidence = parsed.evidence;
  return {
    generalSkills,
    technologies:
      evidence.technologies === undefined
        ? generalSkills
        : normalizedUniqueTerms(evidence.technologies),
    softSkills: normalizedUniqueTerms(evidence.softSkills),
    certifications: normalizedUniqueTerms([
      ...(evidence.certifications ?? []),
      ...confirmedCertificationTitles(profile),
    ]),
    languages: normalizedUniqueTerms(
      evidence.languages?.map((language) => language.language),
    ),
  };
}

function categorizedRequirements(
  sources: ReadonlyArray<{
    category: ComparableRequirementCategory;
    values: unknown;
  }>,
): CategorizedRequirement[] {
  const result: CategorizedRequirement[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const requirement of normalizedUniqueTerms(source.values)) {
      const normalizedKey = comparisonKey(requirement);
      if (seen.has(normalizedKey)) continue;

      seen.add(normalizedKey);
      result.push({
        category: source.category,
        requirement,
        normalizedKey,
      });
    }
  }

  return result;
}

function roundCoveragePercentage(matched: number, total: number) {
  return total === 0 ? null : Math.round((matched / total) * 100);
}

function coverageGroup(
  requirements: readonly CategorizedRequirement[],
  candidatesForCategory: (
    category: ComparableRequirementCategory,
  ) => readonly string[],
): RequirementCoverageGroup {
  const candidateMaps = new Map<
    ComparableRequirementCategory,
    Map<string, string>
  >();
  const matchedItems: MatchedRequirementItem[] = [];
  const notEvidencedItems: NotEvidencedRequirementItem[] = [];

  for (const item of requirements) {
    let candidateByKey = candidateMaps.get(item.category);
    if (!candidateByKey) {
      candidateByKey = new Map(
        candidatesForCategory(item.category).map((candidate) => [
          comparisonKey(candidate),
          candidate,
        ]),
      );
      candidateMaps.set(item.category, candidateByKey);
    }
    const matchedCandidateTerm = candidateByKey.get(item.normalizedKey);
    if (matchedCandidateTerm !== undefined) {
      matchedItems.push({
        category: item.category,
        requirement: item.requirement,
        matchedCandidateTerm,
      });
    } else {
      notEvidencedItems.push({
        category: item.category,
        requirement: item.requirement,
      });
    }
  }

  return {
    totalUniqueRequirements: requirements.length,
    matchedCount: matchedItems.length,
    coveragePercentage: roundCoveragePercentage(
      matchedItems.length,
      requirements.length,
    ),
    matchedItems,
    notEvidencedItems,
  };
}

function candidateWorkAuthorization(profile: MasterProfileData) {
  const profileValue = profile as unknown as Record<string, unknown>;
  return normalizeTerm(profileValue.workAuthorization);
}

function workAuthorizationMatch(
  jobRequirementsValue: unknown,
  candidateValue: string | null,
): WorkAuthorizationMatch {
  const jobRequirements = normalizedUniqueTerms(jobRequirementsValue);
  if (jobRequirements.length === 0) {
    return {
      status: "no_job_requirement",
      jobRequirements,
      candidateValue,
    };
  }
  if (!candidateValue) {
    return {
      status: "no_candidate_value",
      jobRequirements,
      candidateValue: null,
    };
  }

  const candidateKey = comparisonKey(candidateValue);
  const matchedRequirement = jobRequirements.find(
    (requirement) => comparisonKey(requirement) === candidateKey,
  );
  if (matchedRequirement) {
    return {
      status: "exact_match",
      jobRequirements,
      candidateValue,
      matchedRequirement,
    };
  }

  return {
    status: "mismatch",
    jobRequirements,
    candidateValue,
  };
}

function unassessedRequirements(
  requirements: CanonicalJobRequirements,
): UnassessedRequirementItem[] {
  const requirementValue = requirements as unknown as Record<string, unknown>;
  const sources: ReadonlyArray<{
    category: UnassessedRequirementCategory;
    values: unknown;
  }> = [
    { category: "education", values: requirementValue.education },
    { category: "experience", values: requirementValue.experience },
    { category: "responsibility", values: requirementValue.responsibilities },
    {
      category: "uncategorized_requirement",
      values: requirementValue.uncategorizedRequirements,
    },
  ];

  return sources.flatMap((source) =>
    normalizedUniqueTerms(source.values).map((requirement) => ({
      category: source.category,
      requirement,
    })),
  );
}

export function matchResumeToJob(
  requirements: CanonicalJobRequirements,
  profile: MasterProfileData,
): ResumeJobExactMatchResult {
  const requirementValue = requirements as unknown as Record<string, unknown>;
  const candidates = categorizedCandidateTerms(profile);
  const requiredItems = categorizedRequirements([
    { category: "required_skill", values: requirementValue.requiredSkills },
    {
      category: "required_technology",
      values: requirementValue.requiredTechnologies,
    },
  ]);
  const preferredItems = categorizedRequirements([
    { category: "preferred_skill", values: requirementValue.preferredSkills },
    {
      category: "preferred_technology",
      values: requirementValue.preferredTechnologies,
    },
  ]);
  const keywordItems = categorizedRequirements([
    { category: "keyword", values: requirementValue.keywords },
  ]);
  const candidatesForCategory = (category: ComparableRequirementCategory) => {
    switch (category) {
      case "required_technology":
      case "preferred_technology":
        return candidates.technologies;
      case "soft_skill":
        return candidates.softSkills;
      case "certification":
        return candidates.certifications;
      case "language":
        return candidates.languages;
      default:
        return candidates.generalSkills;
    }
  };
  const required = coverageGroup(requiredItems, candidatesForCategory);
  const preferred = coverageGroup(preferredItems, candidatesForCategory);
  const keywords = coverageGroup(keywordItems, candidatesForCategory);
  const softSkills = coverageGroup(
    categorizedRequirements([
      { category: "soft_skill", values: requirementValue.softSkills },
    ]),
    candidatesForCategory,
  );
  const certifications = coverageGroup(
    categorizedRequirements([
      { category: "certification", values: requirementValue.certifications },
    ]),
    candidatesForCategory,
  );
  const languages = coverageGroup(
    categorizedRequirements([
      { category: "language", values: requirementValue.languages },
    ]),
    candidatesForCategory,
  );
  const workAuthorization = workAuthorizationMatch(
    requirementValue.workAuthorization,
    candidateWorkAuthorization(profile),
  );
  const unassessed = unassessedRequirements(requirements);
  const comparableJobTerms =
    required.totalUniqueRequirements +
    preferred.totalUniqueRequirements +
    keywords.totalUniqueRequirements +
    softSkills.totalUniqueRequirements +
    certifications.totalUniqueRequirements +
    languages.totalUniqueRequirements;
  const uniqueCandidateTerms = normalizedUniqueTerms([
    ...candidates.generalSkills,
    ...candidates.technologies,
    ...candidates.softSkills,
    ...candidates.certifications,
    ...candidates.languages,
  ]).length;

  const status: ResumeJobMatchStatus =
    comparableJobTerms === 0 &&
    workAuthorization.status === "no_job_requirement"
      ? "insufficient_job_data"
      : comparableJobTerms > 0 &&
          uniqueCandidateTerms === 0 &&
          workAuthorization.candidateValue === null
        ? "insufficient_candidate_data"
        : "comparable";

  return {
    contractVersion: RESUME_JOB_EXACT_MATCH_VERSION,
    status,
    required,
    preferred,
    keywords,
    softSkills,
    certifications,
    languages,
    workAuthorization,
    dataCompleteness: {
      uniqueCandidateTerms,
      comparableJobTerms,
      unassessedJobRequirements: unassessed.length,
    },
    unassessedRequirements: unassessed,
  };
}
