import type { ComparableRequirementCategory } from "@/lib/matching/resume-job-match";

import {
  immutableTailoringProviderInput,
  TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
  TAILORING_PROVIDER_LIMITS,
  tailoringProviderInputV1Schema,
  type TailoringProviderInputV1,
} from "./tailoring-provider-contracts";
import {
  TAILORING_PREFLIGHT_CONTRACT_VERSION,
  type TailoringEvidenceSourceType,
  type TailoringMatchedEvidence,
  type TailoringPreflightPackage,
} from "./tailoring-preflight";

type EvidenceCategory =
  TailoringProviderInputV1["approvedCandidateEvidence"][number]["category"];
type RequirementModality = TailoringProviderInputV1["jobContext"]["matchedRequirements"][number]["modality"];

export type BuildTailoringProviderInputResult =
  | Readonly<{ status: "success"; input: TailoringProviderInputV1 }>
  | Readonly<{
      status: "not_ready";
      readiness: "insufficient_job_data" | "insufficient_candidate_data";
    }>
  | Readonly<{ status: "invalid_preflight" }>;

function normalizeBounded(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function comparisonKey(value: string) {
  return value.toLocaleLowerCase("en-CA");
}

function categoryForSource(
  sourceType: TailoringEvidenceSourceType,
  term: string,
  skillKeys: ReadonlySet<string>,
): EvidenceCategory {
  switch (sourceType) {
    case "top_level_general_skill":
    case "confirmed_entry_skill":
      return skillKeys.has(comparisonKey(term)) ? "general_skill" : "keyword";
    case "explicit_technology":
    case "legacy_technology_fallback":
      return "technology";
    case "explicit_soft_skill":
      return "soft_skill";
    case "explicit_certification":
    case "confirmed_certification_title":
      return "certification";
    case "explicit_language":
      return "language";
  }
}

function requirementModality(
  category: ComparableRequirementCategory,
): RequirementModality {
  if (category === "required_skill" || category === "required_technology") {
    return "required";
  }
  if (category === "preferred_skill" || category === "preferred_technology") {
    return "preferred";
  }
  return "non_modal";
}

function matchedEntries(preflight: TailoringPreflightPackage) {
  return [
    ...preflight.matched.requiredSkills.map((item) => ({
      category: "required_skill" as const,
      item,
    })),
    ...preflight.matched.preferredSkills.map((item) => ({
      category: "preferred_skill" as const,
      item,
    })),
    ...preflight.matched.requiredTechnologies.map((item) => ({
      category: "required_technology" as const,
      item,
    })),
    ...preflight.matched.preferredTechnologies.map((item) => ({
      category: "preferred_technology" as const,
      item,
    })),
    ...preflight.matched.softSkills.map((item) => ({
      category: "soft_skill" as const,
      item,
    })),
    ...preflight.matched.certifications.map((item) => ({
      category: "certification" as const,
      item,
    })),
    ...preflight.matched.languages.map((item) => ({
      category: "language" as const,
      item,
    })),
    ...preflight.matched.keywords.map((item) => ({
      category: "keyword" as const,
      item,
    })),
  ];
}

function evidenceCategoryForRequirement(
  category: ComparableRequirementCategory,
): EvidenceCategory | null {
  switch (category) {
    case "required_skill":
    case "preferred_skill":
      return "general_skill";
    case "required_technology":
    case "preferred_technology":
      return "technology";
    case "soft_skill":
      return "soft_skill";
    case "certification":
      return "certification";
    case "language":
      return "language";
    case "keyword":
      return null;
  }
}

function findEvidenceId(
  evidence: TailoringProviderInputV1["approvedCandidateEvidence"],
  category: ComparableRequirementCategory,
  matchedCandidateTerm: string,
) {
  const key = comparisonKey(matchedCandidateTerm);
  const expectedCategory = evidenceCategoryForRequirement(category);
  const exactCategoryMatch = evidence.find(
    (item) =>
      comparisonKey(item.term) === key && item.category === expectedCategory,
  );
  if (exactCategoryMatch) return exactCategoryMatch.evidenceId;

  if (category === "keyword") {
    return evidence.find((item) => comparisonKey(item.term) === key)?.evidenceId;
  }
  return undefined;
}

function normalizedMatchedItem(
  item: TailoringMatchedEvidence,
): Readonly<{ requirement: string; matchedCandidateTerm: string }> | null {
  const requirement = normalizeBounded(
    item.requirement,
    TAILORING_PROVIDER_LIMITS.contextTerm,
  );
  const matchedCandidateTerm = normalizeBounded(
    item.matchedCandidateTerm,
    TAILORING_PROVIDER_LIMITS.evidenceTerm,
  );
  return requirement && matchedCandidateTerm
    ? { requirement, matchedCandidateTerm }
    : null;
}

export function buildTailoringProviderInput(
  preflight: TailoringPreflightPackage,
): BuildTailoringProviderInputResult {
  if (
    !preflight ||
    preflight.contractVersion !== TAILORING_PREFLIGHT_CONTRACT_VERSION
  ) {
    return { status: "invalid_preflight" };
  }
  if (preflight.readiness !== "ready") {
    if (
      preflight.readiness === "insufficient_job_data" ||
      preflight.readiness === "insufficient_candidate_data"
    ) {
      return { status: "not_ready", readiness: preflight.readiness };
    }
    return { status: "invalid_preflight" };
  }

  try {
    const title = normalizeBounded(
      preflight.job.title,
      TAILORING_PROVIDER_LIMITS.jobTitle,
    );
    const companyName = normalizeBounded(
      preflight.job.companyName,
      TAILORING_PROVIDER_LIMITS.companyName,
    );
    const location =
      preflight.job.location === undefined
        ? undefined
        : normalizeBounded(
            preflight.job.location,
            TAILORING_PROVIDER_LIMITS.location,
          );
    if (!title || !companyName) {
      return { status: "invalid_preflight" };
    }
    if (preflight.job.location !== undefined && !location) {
      return { status: "invalid_preflight" };
    }

    const matched = matchedEntries(preflight);
    const skillKeys = new Set(
      matched
        .filter(
          ({ category }) =>
            category === "required_skill" || category === "preferred_skill",
        )
        .map(({ item }) => comparisonKey(item.matchedCandidateTerm)),
    );
    const approvedCandidateEvidence: Array<
      TailoringProviderInputV1["approvedCandidateEvidence"][number]
    > = [];
    const evidenceKeys = new Set<string>();

    for (const reference of preflight.supportingEvidence) {
      const sourceLabel = normalizeBounded(
        reference.displayTitle,
        TAILORING_PROVIDER_LIMITS.sourceLabel,
      );
      if (!sourceLabel) return { status: "invalid_preflight" };

      for (const rawTerm of reference.matchedTerms) {
        const term = normalizeBounded(
          rawTerm,
          TAILORING_PROVIDER_LIMITS.evidenceTerm,
        );
        if (!term) return { status: "invalid_preflight" };
        const category = categoryForSource(reference.sourceType, term, skillKeys);
        const duplicateKey = `${category}:${comparisonKey(term)}`;
        if (evidenceKeys.has(duplicateKey)) continue;
        evidenceKeys.add(duplicateKey);
        approvedCandidateEvidence.push({
          evidenceId: `ev_${String(approvedCandidateEvidence.length + 1).padStart(3, "0")}`,
          category,
          term,
          sourceType: reference.sourceType,
          sourceLabel,
          ...(category === "language" && reference.languageProficiency
            ? { languageProficiency: reference.languageProficiency }
            : {}),
        });
      }
    }

    if (
      approvedCandidateEvidence.length > TAILORING_PROVIDER_LIMITS.evidenceItems
    ) {
      return { status: "invalid_preflight" };
    }

    const matchedRequirements = matched.map(({ category, item }) => {
      const normalized = normalizedMatchedItem(item);
      if (!normalized) throw new Error("invalid matched requirement");
      const evidenceId = findEvidenceId(
        approvedCandidateEvidence,
        category,
        normalized.matchedCandidateTerm,
      );
      if (!evidenceId) throw new Error("matched requirement lacks evidence");
      return {
        category,
        modality: requirementModality(category),
        requirement: normalized.requirement,
        evidenceId,
      };
    });

    let contextIndex = 0;
    const nextContextId = () =>
      `ctx_${String(++contextIndex).padStart(3, "0")}`;
    const notEvidencedRequirements = preflight.notEvidenced.map((item) => {
      const requirement = normalizeBounded(
        item.requirement,
        TAILORING_PROVIDER_LIMITS.contextTerm,
      );
      if (!requirement) throw new Error("invalid context requirement");
      return {
        contextId: nextContextId(),
        category: item.category,
        requirement,
      };
    });
    const responsibilities = preflight.jobContext.responsibilities.map(
      (rawResponsibility) => {
        const responsibility = normalizeBounded(
          rawResponsibility,
          TAILORING_PROVIDER_LIMITS.contextTerm,
        );
        if (!responsibility) throw new Error("invalid responsibility");
        return { contextId: nextContextId(), responsibility };
      },
    );
    const unassessedCategories = preflight.unassessed.categories.map((item) => {
      const category = normalizeBounded(item.category, 80);
      if (!category || !Number.isInteger(item.count) || item.count <= 0) {
        throw new Error("invalid unassessed category");
      }
      return { contextId: nextContextId(), category, count: item.count };
    });

    const candidate = {
      contractVersion: TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
      job: {
        title,
        companyName,
        ...(location ? { location } : {}),
      },
      approvedCandidateEvidence,
      jobContext: {
        matchedRequirements,
        notEvidencedRequirements,
        responsibilities,
        unassessed: {
          total: preflight.unassessed.total,
          categories: unassessedCategories,
        },
        workAuthorization: structuredClone(preflight.workAuthorization),
      },
      prohibitedClaimCategories: [...TAILORING_PROHIBITED_CLAIM_CATEGORIES],
    };
    const parsed = tailoringProviderInputV1Schema.safeParse(candidate);
    if (!parsed.success) return { status: "invalid_preflight" };

    return {
      status: "success",
      input: immutableTailoringProviderInput(parsed.data),
    };
  } catch {
    return { status: "invalid_preflight" };
  }
}
