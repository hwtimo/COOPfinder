import { z } from "zod";

import { CANDIDATE_LANGUAGE_PROFICIENCIES } from "@/lib/master-profile/candidate-evidence";

export const TAILORING_PROVIDER_INPUT_CONTRACT_VERSION =
  "tailoring-provider-input-v1" as const;
export const TAILORING_PLAN_OUTPUT_CONTRACT_VERSION =
  "tailoring-plan-output-v1" as const;

export const TAILORING_PROVIDER_LIMITS = {
  jobTitle: 200,
  companyName: 160,
  location: 160,
  evidenceItems: 300,
  evidenceTerm: 160,
  sourceLabel: 160,
  matchedRequirements: 400,
  contextItems: 400,
  contextTerm: 1_000,
  contextCategories: 20,
  summaryEvidenceReferences: 8,
  sections: 6,
  sectionItems: 12,
  referenceId: 16,
} as const;

export const TAILORING_EVIDENCE_CATEGORIES = [
  "general_skill",
  "technology",
  "soft_skill",
  "certification",
  "language",
  "keyword",
] as const;

export const TAILORING_EVIDENCE_SOURCE_TYPES = [
  "top_level_general_skill",
  "confirmed_entry_skill",
  "explicit_technology",
  "legacy_technology_fallback",
  "explicit_soft_skill",
  "explicit_certification",
  "confirmed_certification_title",
  "explicit_language",
] as const;

export const TAILORING_REQUIREMENT_CATEGORIES = [
  "required_skill",
  "required_technology",
  "preferred_skill",
  "preferred_technology",
  "keyword",
  "soft_skill",
  "certification",
  "language",
] as const;

export const TAILORING_REQUIREMENT_MODALITIES = [
  "required",
  "preferred",
  "non_modal",
] as const;

type EvidenceCategory = (typeof TAILORING_EVIDENCE_CATEGORIES)[number];

const REQUIREMENT_EVIDENCE_CATEGORY: Readonly<
  Record<
    (typeof TAILORING_REQUIREMENT_CATEGORIES)[number],
    EvidenceCategory | null
  >
> = {
  required_skill: "general_skill",
  preferred_skill: "general_skill",
  required_technology: "technology",
  preferred_technology: "technology",
  keyword: null,
  soft_skill: "soft_skill",
  certification: "certification",
  language: "language",
};

export const TAILORING_PLAN_SECTION_TYPES = [
  "general_skills",
  "technologies",
  "soft_skills",
  "certifications",
  "languages",
  "supporting_evidence",
] as const;

export const TAILORING_PROHIBITED_CLAIM_CATEGORIES = Object.freeze([
  "employers",
  "job_titles",
  "dates",
  "durations",
  "metrics",
  "education",
  "experience",
  "projects",
  "responsibilities",
  "achievements",
  "skills",
  "technologies",
  "certifications",
  "languages",
  "work_authorization",
  "contact_details",
] as const);

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : { readonly [Key in keyof T]: DeepReadonly<T[Key]> };

function normalizedBoundedString(maxLength: number) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.replace(/\s+/g, " ").trim() === value, {
      message: "String must be normalized",
    });
}

const evidenceIdSchema = normalizedBoundedString(
  TAILORING_PROVIDER_LIMITS.referenceId,
);
const contextIdSchema = normalizedBoundedString(
  TAILORING_PROVIDER_LIMITS.referenceId,
);
const contextTermSchema = normalizedBoundedString(
  TAILORING_PROVIDER_LIMITS.contextTerm,
);

export const tailoringCandidateEvidenceSchema = z
  .object({
    evidenceId: evidenceIdSchema,
    category: z.enum(TAILORING_EVIDENCE_CATEGORIES),
    term: normalizedBoundedString(TAILORING_PROVIDER_LIMITS.evidenceTerm),
    sourceType: z.enum(TAILORING_EVIDENCE_SOURCE_TYPES),
    sourceLabel: normalizedBoundedString(
      TAILORING_PROVIDER_LIMITS.sourceLabel,
    ).optional(),
    languageProficiency: z
      .enum(CANDIDATE_LANGUAGE_PROFICIENCIES)
      .optional(),
  })
  .strict()
  .superRefine((item, context) => {
    if (
      item.languageProficiency !== undefined &&
      item.category !== "language"
    ) {
      context.addIssue({
        code: "custom",
        message: "Language proficiency is limited to language evidence",
        path: ["languageProficiency"],
      });
    }
  });

const matchedRequirementSchema = z
  .object({
    category: z.enum(TAILORING_REQUIREMENT_CATEGORIES),
    modality: z.enum(TAILORING_REQUIREMENT_MODALITIES),
    requirement: contextTermSchema,
    evidenceId: evidenceIdSchema,
  })
  .strict();

const contextRequirementSchema = z
  .object({
    contextId: contextIdSchema,
    category: z.enum(TAILORING_REQUIREMENT_CATEGORIES),
    requirement: contextTermSchema,
  })
  .strict();

const responsibilityContextSchema = z
  .object({
    contextId: contextIdSchema,
    responsibility: contextTermSchema,
  })
  .strict();

const unassessedContextSchema = z
  .object({
    contextId: contextIdSchema,
    category: normalizedBoundedString(80),
    count: z.number().int().positive().max(1_000),
  })
  .strict();

const workAuthorizationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("no_job_requirement"),
      jobRequirements: z.array(contextTermSchema).max(80),
      candidateValue: normalizedBoundedString(160).nullable(),
    })
    .strict(),
  z
    .object({
      status: z.literal("no_candidate_value"),
      jobRequirements: z.array(contextTermSchema).min(1).max(80),
      candidateValue: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.literal("exact_match"),
      jobRequirements: z.array(contextTermSchema).min(1).max(80),
      candidateValue: normalizedBoundedString(160),
      matchedRequirement: contextTermSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("mismatch"),
      jobRequirements: z.array(contextTermSchema).min(1).max(80),
      candidateValue: normalizedBoundedString(160),
    })
    .strict(),
]);

export const tailoringProviderInputV1Schema = z
  .object({
    contractVersion: z.literal(TAILORING_PROVIDER_INPUT_CONTRACT_VERSION),
    job: z
      .object({
        title: normalizedBoundedString(TAILORING_PROVIDER_LIMITS.jobTitle),
        companyName: normalizedBoundedString(
          TAILORING_PROVIDER_LIMITS.companyName,
        ),
        location: normalizedBoundedString(
          TAILORING_PROVIDER_LIMITS.location,
        ).optional(),
      })
      .strict(),
    approvedCandidateEvidence: z
      .array(tailoringCandidateEvidenceSchema)
      .max(TAILORING_PROVIDER_LIMITS.evidenceItems),
    jobContext: z
      .object({
        matchedRequirements: z
          .array(matchedRequirementSchema)
          .max(TAILORING_PROVIDER_LIMITS.matchedRequirements),
        notEvidencedRequirements: z
          .array(contextRequirementSchema)
          .max(TAILORING_PROVIDER_LIMITS.contextItems),
        responsibilities: z
          .array(responsibilityContextSchema)
          .max(TAILORING_PROVIDER_LIMITS.contextItems),
        unassessed: z
          .object({
            total: z.number().int().nonnegative().max(10_000),
            categories: z
              .array(unassessedContextSchema)
              .max(TAILORING_PROVIDER_LIMITS.contextCategories),
          })
          .strict(),
        workAuthorization: workAuthorizationSchema,
      })
      .strict(),
    prohibitedClaimCategories: z.tuple(
      TAILORING_PROHIBITED_CLAIM_CATEGORIES.map((category) =>
        z.literal(category),
      ) as [
        z.ZodLiteral<(typeof TAILORING_PROHIBITED_CLAIM_CATEGORIES)[number]>,
        ...z.ZodLiteral<
          (typeof TAILORING_PROHIBITED_CLAIM_CATEGORIES)[number]
        >[],
      ],
    ),
  })
  .strict()
  .superRefine((input, context) => {
    const evidenceIds = new Set<string>();
    const evidenceFacts = new Set<string>();
    const contextIds = new Set<string>();
    const evidenceCategories = new Map<string, EvidenceCategory>();
    const compatibleSourceCategories: Readonly<
      Record<
        (typeof TAILORING_EVIDENCE_SOURCE_TYPES)[number],
        readonly EvidenceCategory[]
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

    for (const [index, item] of input.approvedCandidateEvidence.entries()) {
      if (evidenceIds.has(item.evidenceId)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate evidence ID",
          path: ["approvedCandidateEvidence", index, "evidenceId"],
        });
      }
      evidenceIds.add(item.evidenceId);
      evidenceCategories.set(item.evidenceId, item.category);
      const factKey = `${item.category}:${item.term.toLocaleLowerCase("en-CA")}`;
      if (evidenceFacts.has(factKey)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate candidate evidence",
          path: ["approvedCandidateEvidence", index, "term"],
        });
      }
      evidenceFacts.add(factKey);
      if (!compatibleSourceCategories[item.sourceType].includes(item.category)) {
        context.addIssue({
          code: "custom",
          message: "Evidence source is incompatible with its category",
          path: ["approvedCandidateEvidence", index, "category"],
        });
      }
    }

    const registerContextId = (contextId: string, path: PropertyKey[]) => {
      if (contextIds.has(contextId) || evidenceIds.has(contextId)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate context ID",
          path,
        });
      }
      contextIds.add(contextId);
    };
    input.jobContext.notEvidencedRequirements.forEach((item, index) =>
      registerContextId(item.contextId, [
        "jobContext",
        "notEvidencedRequirements",
        index,
        "contextId",
      ]),
    );
    input.jobContext.responsibilities.forEach((item, index) =>
      registerContextId(item.contextId, [
        "jobContext",
        "responsibilities",
        index,
        "contextId",
      ]),
    );
    input.jobContext.unassessed.categories.forEach((item, index) =>
      registerContextId(item.contextId, [
        "jobContext",
        "unassessed",
        "categories",
        index,
        "contextId",
      ]),
    );

    for (const [index, requirement] of input.jobContext.matchedRequirements.entries()) {
      const category = evidenceCategories.get(requirement.evidenceId);
      const expectedCategory = REQUIREMENT_EVIDENCE_CATEGORY[requirement.category];
      const expectedModality =
        requirement.category === "required_skill" ||
        requirement.category === "required_technology"
          ? "required"
          : requirement.category === "preferred_skill" ||
              requirement.category === "preferred_technology"
            ? "preferred"
            : "non_modal";
      if (!category || (expectedCategory && category !== expectedCategory)) {
        context.addIssue({
          code: "custom",
          message: "Matched requirement must reference compatible evidence",
          path: ["jobContext", "matchedRequirements", index, "evidenceId"],
        });
      }
      if (requirement.modality !== expectedModality) {
        context.addIssue({
          code: "custom",
          message: "Requirement modality is incompatible with its category",
          path: ["jobContext", "matchedRequirements", index, "modality"],
        });
      }
    }

    const unassessedTotal = input.jobContext.unassessed.categories.reduce(
      (total, item) => total + item.count,
      0,
    );
    if (unassessedTotal !== input.jobContext.unassessed.total) {
      context.addIssue({
        code: "custom",
        message: "Unassessed total must equal its category counts",
        path: ["jobContext", "unassessed", "total"],
      });
    }
  });

export type TailoringProviderInputV1 = DeepReadonly<
  z.infer<typeof tailoringProviderInputV1Schema>
>;

const tailoringPlanItemSchema = z
  .object({ evidenceId: evidenceIdSchema })
  .strict();

const tailoringPlanSectionSchema = z
  .object({
    type: z.enum(TAILORING_PLAN_SECTION_TYPES),
    items: z
      .array(tailoringPlanItemSchema)
      .min(1)
      .max(TAILORING_PROVIDER_LIMITS.sectionItems),
  })
  .strict();

export const tailoringPlanOutputV1Schema = z
  .object({
    contractVersion: z.literal(TAILORING_PLAN_OUTPUT_CONTRACT_VERSION),
    summaryEvidenceIds: z
      .array(evidenceIdSchema)
      .max(TAILORING_PROVIDER_LIMITS.summaryEvidenceReferences),
    sections: z
      .array(tailoringPlanSectionSchema)
      .max(TAILORING_PROVIDER_LIMITS.sections),
  })
  .strict()
  .superRefine((plan, context) => {
    const sectionTypes = new Set<string>();
    const evidenceIds = new Set<string>();

    for (const [index, evidenceId] of plan.summaryEvidenceIds.entries()) {
      if (evidenceIds.has(evidenceId)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate evidence reference",
          path: ["summaryEvidenceIds", index],
        });
      }
      evidenceIds.add(evidenceId);
    }

    for (const [sectionIndex, section] of plan.sections.entries()) {
      if (sectionTypes.has(section.type)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate section type",
          path: ["sections", sectionIndex, "type"],
        });
      }
      sectionTypes.add(section.type);

      for (const [itemIndex, item] of section.items.entries()) {
        if (evidenceIds.has(item.evidenceId)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate evidence reference",
            path: ["sections", sectionIndex, "items", itemIndex, "evidenceId"],
          });
        }
        evidenceIds.add(item.evidenceId);
      }
    }
  });

export type TailoringPlanOutputV1 = DeepReadonly<
  z.infer<typeof tailoringPlanOutputV1Schema>
>;

export type ValidateTailoringPlanResult =
  | Readonly<{ status: "valid"; plan: TailoringPlanOutputV1 }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid_input"
        | "invalid_shape"
        | "context_only_reference"
        | "unknown_evidence"
        | "incompatible_section";
    }>;

export const TAILORING_PLAN_SECTION_COMPATIBILITY: Readonly<
  Record<
    (typeof TAILORING_EVIDENCE_CATEGORIES)[number],
    readonly (typeof TAILORING_PLAN_SECTION_TYPES)[number][]
  >
> = {
  general_skill: ["general_skills", "supporting_evidence"],
  technology: ["technologies", "supporting_evidence"],
  soft_skill: ["soft_skills", "supporting_evidence"],
  certification: ["certifications", "supporting_evidence"],
  language: ["languages", "supporting_evidence"],
  keyword: ["supporting_evidence"],
};

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }

  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

export function immutableTailoringProviderInput(
  value: z.infer<typeof tailoringProviderInputV1Schema>,
): TailoringProviderInputV1 {
  return deepFreeze(value);
}

export function validateTailoringPlanOutput(
  inputValue: TailoringProviderInputV1,
  outputValue: unknown,
): ValidateTailoringPlanResult {
  const inputResult = tailoringProviderInputV1Schema.safeParse(inputValue);
  if (!inputResult.success) return { status: "invalid", reason: "invalid_input" };

  const planResult = tailoringPlanOutputV1Schema.safeParse(outputValue);
  if (!planResult.success) return { status: "invalid", reason: "invalid_shape" };

  const evidenceById = new Map(
    inputResult.data.approvedCandidateEvidence.map((item) => [
      item.evidenceId,
      item,
    ]),
  );
  const contextIds = new Set([
    ...inputResult.data.jobContext.notEvidencedRequirements.map(
      (item) => item.contextId,
    ),
    ...inputResult.data.jobContext.responsibilities.map(
      (item) => item.contextId,
    ),
    ...inputResult.data.jobContext.unassessed.categories.map(
      (item) => item.contextId,
    ),
  ]);
  const referencedIds = [
    ...planResult.data.summaryEvidenceIds,
    ...planResult.data.sections.flatMap((section) =>
      section.items.map((item) => item.evidenceId),
    ),
  ];

  for (const evidenceId of referencedIds) {
    if (contextIds.has(evidenceId)) {
      return { status: "invalid", reason: "context_only_reference" };
    }
    if (!evidenceById.has(evidenceId)) {
      return { status: "invalid", reason: "unknown_evidence" };
    }
  }

  for (const section of planResult.data.sections) {
    for (const item of section.items) {
      const evidence = evidenceById.get(item.evidenceId);
      if (
        !evidence ||
        !TAILORING_PLAN_SECTION_COMPATIBILITY[evidence.category].includes(
          section.type,
        )
      ) {
        return { status: "invalid", reason: "incompatible_section" };
      }
    }
  }

  return { status: "valid", plan: deepFreeze(planResult.data) };
}
