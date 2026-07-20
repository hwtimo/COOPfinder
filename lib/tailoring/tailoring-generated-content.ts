import { z } from "zod";

import { CANDIDATE_LANGUAGE_PROFICIENCIES } from "@/lib/master-profile/candidate-evidence";

import {
  TAILORING_EVIDENCE_CATEGORIES,
  TAILORING_EVIDENCE_SOURCE_TYPES,
  TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
  TAILORING_PLAN_SECTION_COMPATIBILITY,
  TAILORING_PLAN_SECTION_TYPES,
  TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
  TAILORING_PROVIDER_LIMITS,
  tailoringCandidateEvidenceSchema,
  tailoringPlanOutputV1Schema,
  tailoringProviderInputV1Schema,
  validateTailoringPlanOutput,
  type DeepReadonly,
  type TailoringPlanOutputV1,
  type TailoringProviderInputV1,
} from "./tailoring-provider-contracts";

export const TAILORING_GENERATED_CONTENT_CONTRACT_VERSION =
  "tailoring-generated-content-v1" as const;

const INPUT_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

const normalizedBoundedString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.replace(/\s+/g, " ").trim() === value, {
      message: "String must be normalized",
    });

const safeJobSchema = z
  .object({
    title: normalizedBoundedString(TAILORING_PROVIDER_LIMITS.jobTitle),
    companyName: normalizedBoundedString(
      TAILORING_PROVIDER_LIMITS.companyName,
    ),
    location: normalizedBoundedString(
      TAILORING_PROVIDER_LIMITS.location,
    ).optional(),
  })
  .strict();

function referencedEvidenceIds(plan: TailoringPlanOutputV1): string[] {
  const ordered = [
    ...plan.summaryEvidenceIds,
    ...plan.sections.flatMap((section) =>
      section.items.map((item) => item.evidenceId),
    ),
  ];
  return [...new Set(ordered)];
}

export const tailoringGeneratedContentV1Schema = z
  .object({
    contractVersion: z.literal(TAILORING_GENERATED_CONTENT_CONTRACT_VERSION),
    providerInputContractVersion: z.literal(
      TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
    ),
    providerOutputContractVersion: z.literal(
      TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    ),
    inputFingerprint: z.string().regex(INPUT_FINGERPRINT_PATTERN),
    job: safeJobSchema,
    plan: tailoringPlanOutputV1Schema,
    selectedEvidence: z
      .array(tailoringCandidateEvidenceSchema)
      .max(TAILORING_PROVIDER_LIMITS.evidenceItems),
  })
  .strict()
  .superRefine((content, context) => {
    const expectedIds = referencedEvidenceIds(content.plan);
    const actualIds = content.selectedEvidence.map((item) => item.evidenceId);
    const seenIds = new Set<string>();

    actualIds.forEach((evidenceId, index) => {
      if (!/^ev_[0-9]{3}$/.test(evidenceId)) {
        context.addIssue({
          code: "custom",
          message: "Invalid selected evidence ID",
          path: ["selectedEvidence", index, "evidenceId"],
        });
      }
      if (seenIds.has(evidenceId)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate selected evidence ID",
          path: ["selectedEvidence", index, "evidenceId"],
        });
      }
      seenIds.add(evidenceId);
      if (evidenceId.startsWith("ctx_")) {
        context.addIssue({
          code: "custom",
          message: "Context references cannot be selected evidence",
          path: ["selectedEvidence", index, "evidenceId"],
        });
      }
    });

    const sourceCategories: Readonly<
      Record<
        (typeof TAILORING_EVIDENCE_SOURCE_TYPES)[number],
        readonly (typeof TAILORING_EVIDENCE_CATEGORIES)[number][]
      >
    > = {
      top_level_general_skill: ["general_skill", "keyword"],
      confirmed_entry_skill: ["general_skill", "keyword"],
      explicit_technology: ["technology"],
      legacy_technology_fallback: ["technology"],
      explicit_soft_skill: ["soft_skill"],
      explicit_certification: ["certification"],
      confirmed_certification_title: ["certification"],
      explicit_language: ["language"],
    };
    content.selectedEvidence.forEach((item, index) => {
      if (!sourceCategories[item.sourceType].includes(item.category)) {
        context.addIssue({
          code: "custom",
          message: "Selected evidence source is incompatible with its category",
          path: ["selectedEvidence", index, "category"],
        });
      }
    });

    if (
      expectedIds.length !== actualIds.length ||
      expectedIds.some((evidenceId, index) => evidenceId !== actualIds[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "Selected evidence must exactly follow plan traversal order",
        path: ["selectedEvidence"],
      });
    }

    const evidenceById = new Map(
      content.selectedEvidence.map((item) => [item.evidenceId, item]),
    );
    content.plan.sections.forEach((section, sectionIndex) => {
      section.items.forEach((item, itemIndex) => {
        const evidence = evidenceById.get(item.evidenceId);
        if (
          !evidence ||
          !TAILORING_PLAN_SECTION_COMPATIBILITY[evidence.category].includes(
            section.type,
          )
        ) {
          context.addIssue({
            code: "custom",
            message: "Selected evidence is incompatible with its section",
            path: ["plan", "sections", sectionIndex, "items", itemIndex],
          });
        }
      });
    });
  });

export type TailoringGeneratedContentV1 = DeepReadonly<
  z.infer<typeof tailoringGeneratedContentV1Schema>
>;

export type BuildTailoringGeneratedContentResult =
  | Readonly<{ status: "success"; content: TailoringGeneratedContentV1 }>
  | Readonly<{
      status: "invalid";
      reason: "invalid_input" | "invalid_plan" | "invalid_fingerprint";
    }>;

export function buildTailoringGeneratedContent(
  inputValue: TailoringProviderInputV1,
  planValue: TailoringPlanOutputV1,
  inputFingerprint: string,
): BuildTailoringGeneratedContentResult {
  const input = tailoringProviderInputV1Schema.safeParse(inputValue);
  if (!input.success) return { status: "invalid", reason: "invalid_input" };
  if (!INPUT_FINGERPRINT_PATTERN.test(inputFingerprint)) {
    return { status: "invalid", reason: "invalid_fingerprint" };
  }
  const validatedPlan = validateTailoringPlanOutput(input.data, planValue);
  if (validatedPlan.status !== "valid") {
    return { status: "invalid", reason: "invalid_plan" };
  }

  const evidenceById = new Map(
    input.data.approvedCandidateEvidence.map((item) => [item.evidenceId, item]),
  );
  const selectedEvidence: Array<
    (typeof input.data.approvedCandidateEvidence)[number]
  > = [];
  for (const evidenceId of referencedEvidenceIds(validatedPlan.plan)) {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence) return { status: "invalid", reason: "invalid_plan" };
    selectedEvidence.push(evidence);
  }

  const candidate = {
    contractVersion: TAILORING_GENERATED_CONTENT_CONTRACT_VERSION,
    providerInputContractVersion: TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
    providerOutputContractVersion: TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    inputFingerprint,
    job: { ...input.data.job },
    plan: structuredClone(validatedPlan.plan),
    selectedEvidence: selectedEvidence.map((item) => ({ ...item })),
  };
  const parsed = tailoringGeneratedContentV1Schema.safeParse(candidate);
  return parsed.success
    ? { status: "success", content: deepFreeze(parsed.data) }
    : { status: "invalid", reason: "invalid_plan" };
}

export type ParseTailoringGeneratedContentResult =
  | Readonly<{ status: "valid"; content: TailoringGeneratedContentV1 }>
  | Readonly<{ status: "legacy_content_unavailable" }>
  | Readonly<{ status: "invalid" }>;

export function parseTailoringGeneratedContent(
  value: unknown,
): ParseTailoringGeneratedContentResult {
  const parsed = tailoringGeneratedContentV1Schema.safeParse(value);
  if (parsed.success) {
    return { status: "valid", content: deepFreeze(parsed.data) };
  }
  const legacy = tailoringPlanOutputV1Schema.safeParse(value);
  return legacy.success
    ? { status: "legacy_content_unavailable" }
    : { status: "invalid" };
}

const SECTION_LABELS: Readonly<
  Record<(typeof TAILORING_PLAN_SECTION_TYPES)[number], string>
> = {
  general_skills: "General skills",
  technologies: "Technologies",
  soft_skills: "Soft skills",
  certifications: "Certifications",
  languages: "Languages",
  supporting_evidence: "Supporting evidence",
};

const CATEGORY_LABELS: Readonly<
  Record<(typeof TAILORING_EVIDENCE_CATEGORIES)[number], string>
> = {
  general_skill: "General skill",
  technology: "Technology",
  soft_skill: "Soft skill",
  certification: "Certification",
  language: "Language",
  keyword: "Keyword",
};

const SOURCE_LABELS: Readonly<
  Record<(typeof TAILORING_EVIDENCE_SOURCE_TYPES)[number], string>
> = {
  top_level_general_skill: "Master Profile skill",
  confirmed_entry_skill: "Confirmed profile entry skill",
  explicit_technology: "Master Profile technology",
  legacy_technology_fallback: "Legacy profile skill",
  explicit_soft_skill: "Master Profile soft skill",
  explicit_certification: "Master Profile certification",
  confirmed_certification_title: "Confirmed certification entry",
  explicit_language: "Master Profile language",
};

type ReviewEvidence = Readonly<{
  term: string;
  categoryLabel: string;
  provenanceLabel: string;
  languageProficiency?: (typeof CANDIDATE_LANGUAGE_PROFICIENCIES)[number];
}>;

export type TailoringGeneratedContentReviewViewModel = Readonly<{
  jobHeading: Readonly<{
    title: string;
    companyName: string;
    location?: string;
  }>;
  summaryEvidence: readonly ReviewEvidence[];
  sections: readonly Readonly<{
    type: (typeof TAILORING_PLAN_SECTION_TYPES)[number];
    label: string;
    evidence: readonly ReviewEvidence[];
  }>[];
}>;

export function buildTailoringGeneratedContentReviewViewModel(
  value: unknown,
):
  | Readonly<{
      status: "ready";
      viewModel: TailoringGeneratedContentReviewViewModel;
    }>
  | Readonly<{ status: "invalid_content" }> {
  const parsed = tailoringGeneratedContentV1Schema.safeParse(value);
  if (!parsed.success) return { status: "invalid_content" };

  const evidenceById = new Map(
    parsed.data.selectedEvidence.map((item) => [item.evidenceId, item]),
  );
  const resolve = (evidenceId: string): ReviewEvidence => {
    const item = evidenceById.get(evidenceId)!;
    return {
      term: item.term,
      categoryLabel: CATEGORY_LABELS[item.category],
      provenanceLabel: item.sourceLabel ?? SOURCE_LABELS[item.sourceType],
      ...(item.languageProficiency
        ? { languageProficiency: item.languageProficiency }
        : {}),
    };
  };

  return {
    status: "ready",
    viewModel: {
      jobHeading: { ...parsed.data.job },
      summaryEvidence: parsed.data.plan.summaryEvidenceIds.map(resolve),
      sections: parsed.data.plan.sections.map((section) => ({
        type: section.type,
        label: SECTION_LABELS[section.type],
        evidence: section.items.map((item) => resolve(item.evidenceId)),
      })),
    },
  };
}
