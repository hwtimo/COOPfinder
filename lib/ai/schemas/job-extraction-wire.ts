import { z } from "zod";

import { PRIVATE_JOB_WORK_MODES } from "../../jobs/types";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  JOB_EXTRACTION_LIMITS,
} from "./job-extraction";

const confidenceWireSchema = z.number().min(0).max(1);

function wireString(maxLength: number) {
  return z.string().min(1).max(maxLength);
}

function wireField<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      value: valueSchema.nullable(),
      confidence: confidenceWireSchema,
    })
    .strict();
}

function wireStringArray(maxItems: number, maxItemLength: number) {
  return z.array(wireString(maxItemLength)).max(maxItems);
}

const deadlineWireSchema = wireString(10).regex(/^\d{4}-\d{2}-\d{2}$/);

const conciseRequirementListWireSchema = wireStringArray(
  JOB_EXTRACTION_LIMITS.namedSkills.items,
  JOB_EXTRACTION_LIMITS.namedSkills.itemLength,
);
const detailedRequirementListWireSchema = wireStringArray(
  JOB_EXTRACTION_LIMITS.requirements.items,
  JOB_EXTRACTION_LIMITS.requirements.itemLength,
);

export const structuredJobRequirementsWireSchema = z
  .object({
    requiredSkills: conciseRequirementListWireSchema,
    preferredSkills: conciseRequirementListWireSchema,
    requiredTechnologies: conciseRequirementListWireSchema,
    preferredTechnologies: conciseRequirementListWireSchema,
    education: detailedRequirementListWireSchema,
    certifications: detailedRequirementListWireSchema,
    languages: detailedRequirementListWireSchema,
    workAuthorization: detailedRequirementListWireSchema,
    experience: detailedRequirementListWireSchema,
    responsibilities: wireStringArray(
      JOB_EXTRACTION_LIMITS.responsibilities.items,
      JOB_EXTRACTION_LIMITS.responsibilities.itemLength,
    ),
    softSkills: detailedRequirementListWireSchema,
    keywords: conciseRequirementListWireSchema,
    uncategorizedRequirements: detailedRequirementListWireSchema,
  })
  .strict();

export const jobExtractionWireV1Schema = z
  .object({
    contractVersion: z.literal(JOB_EXTRACTION_CONTRACT_VERSION),
    companyName: wireField(wireString(JOB_EXTRACTION_LIMITS.companyName)),
    title: wireField(wireString(JOB_EXTRACTION_LIMITS.title)),
    location: wireField(wireString(JOB_EXTRACTION_LIMITS.location)),
    workMode: wireField(z.enum(PRIVATE_JOB_WORK_MODES)),
    term: wireField(wireString(JOB_EXTRACTION_LIMITS.term)),
    deadline: wireField(deadlineWireSchema),
    namedSkills: wireField(
      wireStringArray(
        JOB_EXTRACTION_LIMITS.namedSkills.items,
        JOB_EXTRACTION_LIMITS.namedSkills.itemLength,
      ),
    ),
    responsibilities: wireField(
      wireStringArray(
        JOB_EXTRACTION_LIMITS.responsibilities.items,
        JOB_EXTRACTION_LIMITS.responsibilities.itemLength,
      ),
    ),
    requirements: wireField(
      wireStringArray(
        JOB_EXTRACTION_LIMITS.requirements.items,
        JOB_EXTRACTION_LIMITS.requirements.itemLength,
      ),
    ),
    structuredRequirements: structuredJobRequirementsWireSchema,
    overallConfidence: confidenceWireSchema,
  })
  .strict();

export type JobExtractionWireV1 = z.infer<typeof jobExtractionWireV1Schema>;
