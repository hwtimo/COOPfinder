import { z } from "zod";

import { CANDIDATE_LANGUAGE_PROFICIENCIES } from "@/lib/master-profile/candidate-evidence";
import { MASTER_PROFILE_SECTIONS } from "@/lib/master-profile/types";
import type { DeepReadonly } from "./tailoring-provider-contracts";

export const TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION =
  "tailoring-provider-input-v2" as const;
export const TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION =
  "tailoring-plan-output-v2" as const;

export const TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS = Object.freeze([
  "unreferenced employers, roles, dates, durations, metrics, or achievements",
  "unreferenced skills, technologies, certifications, or languages",
  "rewritten or inferred resume bullet text",
  "raw profile, guest-draft, job-description, or extraction prose",
  "additional contact fields beyond the supplied name and email",
] as const);

export const TAILORING_V2_EVIDENCE_CATEGORIES = [
  "skill",
  "technology",
  "certification",
  "language",
] as const;

export const TAILORING_V2_PLAN_SECTION_TYPES = [
  "education",
  "experience",
  "project",
  "skills",
  "technologies",
  "certifications",
  "languages",
  "volunteer",
] as const;

export const TAILORING_V2_LIMITS = {
  referenceId: 32,
  jobTitle: 200,
  companyName: 160,
  location: 160,
  identityName: 160,
  email: 320,
  educationFact: 120,
  requirement: 1_000,
  requirements: 400,
  entries: 100,
  entryHeading: 160,
  fragmentsPerEntry: 20,
  fragmentText: 500,
  tagsPerFragment: 20,
  tag: 80,
  evidence: 300,
  evidenceTerm: 160,
  sections: 8,
  entriesPerSection: 20,
  evidencePerSection: 100,
} as const;

const normalizedString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.replace(/\s+/g, " ").trim() === value, {
      message: "String must be normalized",
    });

const optionalNormalizedString = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => value.replace(/\s+/g, " ").trim() === value, {
      message: "String must be normalized",
    });

const referenceIdSchema = normalizedString(TAILORING_V2_LIMITS.referenceId);
const requirementCategorySchema = z.enum([
  "required_skill",
  "preferred_skill",
  "required_technology",
  "preferred_technology",
  "soft_skill",
  "certification",
  "language",
  "keyword",
]);

const workAuthorizationSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("no_job_requirement"),
      jobRequirements: z.array(normalizedString(160)).max(80),
      candidateValue: normalizedString(160).nullable(),
    })
    .strict(),
  z
    .object({
      status: z.literal("no_candidate_value"),
      jobRequirements: z.array(normalizedString(160)).min(1).max(80),
      candidateValue: z.null(),
    })
    .strict(),
  z
    .object({
      status: z.literal("exact_match"),
      jobRequirements: z.array(normalizedString(160)).min(1).max(80),
      candidateValue: normalizedString(160),
      matchedRequirement: normalizedString(160),
    })
    .strict(),
  z
    .object({
      status: z.literal("mismatch"),
      jobRequirements: z.array(normalizedString(160)).min(1).max(80),
      candidateValue: normalizedString(160),
    })
    .strict(),
]);

const matchedRequirementSchema = z
  .object({
    requirementId: referenceIdSchema,
    category: requirementCategorySchema,
    modality: z.enum(["required", "preferred", "non_modal"]),
    requirement: normalizedString(TAILORING_V2_LIMITS.requirement),
    candidateTerm: normalizedString(TAILORING_V2_LIMITS.evidenceTerm),
  })
  .strict();

const contextRequirementSchema = z
  .object({
    requirementId: referenceIdSchema,
    category: requirementCategorySchema,
    requirement: normalizedString(TAILORING_V2_LIMITS.requirement),
  })
  .strict();

const responsibilitySchema = z
  .object({
    requirementId: referenceIdSchema,
    responsibility: normalizedString(TAILORING_V2_LIMITS.requirement),
  })
  .strict();

const evidenceSchema = z
  .object({
    evidenceId: referenceIdSchema,
    category: z.enum(TAILORING_V2_EVIDENCE_CATEGORIES),
    term: normalizedString(TAILORING_V2_LIMITS.evidenceTerm),
    languageProficiency: z
      .enum(CANDIDATE_LANGUAGE_PROFICIENCIES)
      .optional(),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      evidence.languageProficiency !== undefined &&
      evidence.category !== "language"
    ) {
      context.addIssue({
        code: "custom",
        message: "Language proficiency is limited to language evidence",
        path: ["languageProficiency"],
      });
    }
  });

const fragmentSchema = z
  .object({
    fragmentId: referenceIdSchema,
    text: normalizedString(TAILORING_V2_LIMITS.fragmentText),
    evidenceTags: z
      .array(normalizedString(TAILORING_V2_LIMITS.tag))
      .max(TAILORING_V2_LIMITS.tagsPerFragment),
    provenance: z.literal("manual"),
  })
  .strict();

const entrySchema = z
  .object({
    entryId: referenceIdSchema,
    section: z.enum(MASTER_PROFILE_SECTIONS),
    heading: normalizedString(TAILORING_V2_LIMITS.entryHeading),
    fragments: z
      .array(fragmentSchema)
      .min(1)
      .max(TAILORING_V2_LIMITS.fragmentsPerEntry),
  })
  .strict();

export const tailoringProviderInputV2Schema = z
  .object({
    contractVersion: z.literal(TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION),
    sourceSnapshotContractVersion: z.literal("resume-source-snapshot-v1"),
    job: z
      .object({
        title: normalizedString(TAILORING_V2_LIMITS.jobTitle),
        companyName: normalizedString(TAILORING_V2_LIMITS.companyName),
        location: normalizedString(TAILORING_V2_LIMITS.location).optional(),
      })
      .strict(),
    jobRequirements: z
      .object({
        matched: z
          .array(matchedRequirementSchema)
          .max(TAILORING_V2_LIMITS.requirements),
        notEvidenced: z
          .array(contextRequirementSchema)
          .max(TAILORING_V2_LIMITS.requirements),
        responsibilities: z
          .array(responsibilitySchema)
          .max(TAILORING_V2_LIMITS.requirements),
        unassessed: z
          .object({
            total: z.number().int().nonnegative().max(10_000),
            categories: z
              .array(
                z
                  .object({
                    category: normalizedString(80),
                    count: z.number().int().positive().max(1_000),
                  })
                  .strict(),
              )
              .max(20),
          })
          .strict(),
        workAuthorization: workAuthorizationSchema,
      })
      .strict(),
    identity: z
      .object({
        fullName: optionalNormalizedString(
          TAILORING_V2_LIMITS.identityName,
        ),
        email: optionalNormalizedString(TAILORING_V2_LIMITS.email),
      })
      .strict(),
    education: z
      .object({
        school: optionalNormalizedString(TAILORING_V2_LIMITS.educationFact),
        program: optionalNormalizedString(TAILORING_V2_LIMITS.educationFact),
        gradYear: optionalNormalizedString(4),
        coopTerm: optionalNormalizedString(80),
      })
      .strict(),
    entries: z.array(entrySchema).max(TAILORING_V2_LIMITS.entries),
    evidence: z.array(evidenceSchema).max(TAILORING_V2_LIMITS.evidence),
    unsupportedClaimProhibitions: z.tuple(
      TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS.map((item) =>
        z.literal(item),
      ) as [
        z.ZodLiteral<
          (typeof TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS)[number]
        >,
        ...z.ZodLiteral<
          (typeof TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS)[number]
        >[],
      ],
    ),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = new Set<string>();
    const evidenceFacts = new Set<string>();

    const registerId = (id: string, path: PropertyKey[]) => {
      if (ids.has(id)) {
        context.addIssue({ code: "custom", message: "Duplicate ID", path });
      }
      ids.add(id);
    };

    input.jobRequirements.matched.forEach((item, index) =>
      registerId(item.requirementId, [
        "jobRequirements",
        "matched",
        index,
        "requirementId",
      ]),
    );
    input.jobRequirements.notEvidenced.forEach((item, index) =>
      registerId(item.requirementId, [
        "jobRequirements",
        "notEvidenced",
        index,
        "requirementId",
      ]),
    );
    input.jobRequirements.responsibilities.forEach((item, index) =>
      registerId(item.requirementId, [
        "jobRequirements",
        "responsibilities",
        index,
        "requirementId",
      ]),
    );

    for (const [entryIndex, entry] of input.entries.entries()) {
      registerId(entry.entryId, ["entries", entryIndex, "entryId"]);
      const tagKeys = new Set<string>();
      for (const [fragmentIndex, fragment] of entry.fragments.entries()) {
        registerId(fragment.fragmentId, [
          "entries",
          entryIndex,
          "fragments",
          fragmentIndex,
          "fragmentId",
        ]);
        tagKeys.clear();
        for (const [tagIndex, tag] of fragment.evidenceTags.entries()) {
          const key = tag.toLocaleLowerCase("en-CA");
          if (tagKeys.has(key)) {
            context.addIssue({
              code: "custom",
              message: "Duplicate fragment tag",
              path: [
                "entries",
                entryIndex,
                "fragments",
                fragmentIndex,
                "evidenceTags",
                tagIndex,
              ],
            });
          }
          tagKeys.add(key);
        }
      }
    }

    for (const [index, evidence] of input.evidence.entries()) {
      registerId(evidence.evidenceId, ["evidence", index, "evidenceId"]);
      const factKey = `${evidence.category}:${evidence.term.toLocaleLowerCase("en-CA")}`;
      if (evidenceFacts.has(factKey)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate evidence",
          path: ["evidence", index, "term"],
        });
      }
      evidenceFacts.add(factKey);
    }

    const expectedUnassessed = input.jobRequirements.unassessed.categories.reduce(
      (total, item) => total + item.count,
      0,
    );
    if (expectedUnassessed !== input.jobRequirements.unassessed.total) {
      context.addIssue({
        code: "custom",
        message: "Unassessed total must equal category counts",
        path: ["jobRequirements", "unassessed", "total"],
      });
    }
  });

export type TailoringProviderInputV2 = DeepReadonly<
  z.infer<typeof tailoringProviderInputV2Schema>
>;

const planEntrySelectionSchema = z
  .object({
    entryId: referenceIdSchema,
    fragmentIds: z
      .array(referenceIdSchema)
      .min(1)
      .max(TAILORING_V2_LIMITS.fragmentsPerEntry),
  })
  .strict();

const planSectionSchema = z
  .object({
    type: z.enum(TAILORING_V2_PLAN_SECTION_TYPES),
    entries: z
      .array(planEntrySelectionSchema)
      .max(TAILORING_V2_LIMITS.entriesPerSection),
    evidenceIds: z
      .array(referenceIdSchema)
      .max(TAILORING_V2_LIMITS.evidencePerSection),
  })
  .strict();

export const tailoringPlanOutputV2Schema = z
  .object({
    contractVersion: z.literal(TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION),
    sections: z
      .array(planSectionSchema)
      .min(1)
      .max(TAILORING_V2_LIMITS.sections),
  })
  .strict()
  .superRefine((plan, context) => {
    const sectionTypes = new Set<string>();
    const entryIds = new Set<string>();
    const fragmentIds = new Set<string>();
    const evidenceIds = new Set<string>();

    for (const [sectionIndex, section] of plan.sections.entries()) {
      if (sectionTypes.has(section.type)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate section",
          path: ["sections", sectionIndex, "type"],
        });
      }
      sectionTypes.add(section.type);
      for (const [entryIndex, entry] of section.entries.entries()) {
        if (entryIds.has(entry.entryId)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate entry reference",
            path: ["sections", sectionIndex, "entries", entryIndex, "entryId"],
          });
        }
        entryIds.add(entry.entryId);
        for (const [fragmentIndex, fragmentId] of entry.fragmentIds.entries()) {
          if (fragmentIds.has(fragmentId)) {
            context.addIssue({
              code: "custom",
              message: "Duplicate fragment reference",
              path: [
                "sections",
                sectionIndex,
                "entries",
                entryIndex,
                "fragmentIds",
                fragmentIndex,
              ],
            });
          }
          fragmentIds.add(fragmentId);
        }
      }
      for (const [evidenceIndex, evidenceId] of section.evidenceIds.entries()) {
        if (evidenceIds.has(evidenceId)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate evidence reference",
            path: [
              "sections",
              sectionIndex,
              "evidenceIds",
              evidenceIndex,
            ],
          });
        }
        evidenceIds.add(evidenceId);
      }
    }
  });

export type TailoringPlanOutputV2 = DeepReadonly<
  z.infer<typeof tailoringPlanOutputV2Schema>
>;

export type ValidateTailoringPlanV2Result =
  | Readonly<{ status: "valid"; plan: TailoringPlanOutputV2 }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid_input"
        | "invalid_shape"
        | "context_only_reference"
        | "unknown_entry"
        | "unknown_fragment"
        | "unknown_evidence"
        | "incompatible_section";
    }>;

const entrySectionCompatibility: Readonly<
  Record<
    (typeof MASTER_PROFILE_SECTIONS)[number],
    (typeof TAILORING_V2_PLAN_SECTION_TYPES)[number]
  >
> = {
  education: "education",
  experience: "experience",
  project: "project",
  skills: "skills",
  certification: "certifications",
  volunteer: "volunteer",
};

const evidenceSectionCompatibility: Readonly<
  Record<
    (typeof TAILORING_V2_EVIDENCE_CATEGORIES)[number],
    (typeof TAILORING_V2_PLAN_SECTION_TYPES)[number]
  >
> = {
  skill: "skills",
  technology: "technologies",
  certification: "certifications",
  language: "languages",
};

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

export function immutableTailoringProviderInputV2(
  value: z.infer<typeof tailoringProviderInputV2Schema>,
): TailoringProviderInputV2 {
  return deepFreeze(value);
}

export function validateTailoringPlanOutputV2(
  inputValue: TailoringProviderInputV2,
  outputValue: unknown,
): ValidateTailoringPlanV2Result {
  const inputResult = tailoringProviderInputV2Schema.safeParse(inputValue);
  if (!inputResult.success) return { status: "invalid", reason: "invalid_input" };

  const planResult = tailoringPlanOutputV2Schema.safeParse(outputValue);
  if (!planResult.success) return { status: "invalid", reason: "invalid_shape" };

  const contextIds = new Set([
    ...inputResult.data.jobRequirements.matched.map((item) => item.requirementId),
    ...inputResult.data.jobRequirements.notEvidenced.map(
      (item) => item.requirementId,
    ),
    ...inputResult.data.jobRequirements.responsibilities.map(
      (item) => item.requirementId,
    ),
  ]);
  const entryById = new Map(
    inputResult.data.entries.map((entry) => [entry.entryId, entry]),
  );
  const fragmentEntryById = new Map(
    inputResult.data.entries.flatMap((entry) =>
      entry.fragments.map((fragment) => [fragment.fragmentId, entry.entryId] as const),
    ),
  );
  const evidenceById = new Map(
    inputResult.data.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );

  for (const section of planResult.data.sections) {
    const hasStructuredEducation =
      section.type === "education" &&
      Object.values(inputResult.data.education).some(Boolean);
    if (
      section.entries.length === 0 &&
      section.evidenceIds.length === 0 &&
      !hasStructuredEducation
    ) {
      return { status: "invalid", reason: "invalid_shape" };
    }

    for (const selection of section.entries) {
      if (contextIds.has(selection.entryId)) {
        return { status: "invalid", reason: "context_only_reference" };
      }
      const entry = entryById.get(selection.entryId);
      if (!entry) return { status: "invalid", reason: "unknown_entry" };
      if (entrySectionCompatibility[entry.section] !== section.type) {
        return { status: "invalid", reason: "incompatible_section" };
      }
      for (const fragmentId of selection.fragmentIds) {
        if (contextIds.has(fragmentId)) {
          return { status: "invalid", reason: "context_only_reference" };
        }
        if (fragmentEntryById.get(fragmentId) !== entry.entryId) {
          return { status: "invalid", reason: "unknown_fragment" };
        }
      }
    }

    for (const evidenceId of section.evidenceIds) {
      if (contextIds.has(evidenceId)) {
        return { status: "invalid", reason: "context_only_reference" };
      }
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) return { status: "invalid", reason: "unknown_evidence" };
      if (evidenceSectionCompatibility[evidence.category] !== section.type) {
        return { status: "invalid", reason: "incompatible_section" };
      }
    }
  }

  return { status: "valid", plan: deepFreeze(planResult.data) };
}
