import { z } from "zod";

import { PRIVATE_JOB_WORK_MODES } from "../../jobs/types";
import {
  normalizeJobRequirements,
  type CanonicalJobRequirements,
} from "../../jobs/job-requirement-normalization";
import {
  classifyJobExtractionConfidence,
  type JobExtractionReviewClassification,
} from "../job-extraction-confidence";

export const JOB_EXTRACTION_CONTRACT_VERSION = "job-extraction-v1" as const;

export const JOB_EXTRACTION_LIMITS = {
  companyName: 160,
  title: 200,
  location: 160,
  term: 120,
  namedSkills: { items: 60, itemLength: 80 },
  responsibilities: { items: 50, itemLength: 1_000 },
  requirements: { items: 80, itemLength: 1_000 },
} as const;

const confidenceSchema = z.number().finite().min(0).max(1);

function nonBlankString(maxLength: number) {
  return z.string().trim().min(1).max(maxLength);
}

function extractedField<T extends z.ZodType>(valueSchema: T) {
  return z
    .object({
      value: valueSchema.nullable(),
      confidence: confidenceSchema,
    })
    .strict();
}

function normalizedDuplicateKey(value: string) {
  return value.replace(/\s+/g, " ").toLocaleLowerCase("en-CA");
}

function uniqueStringArray(maxItems: number, maxItemLength: number) {
  return z
    .array(nonBlankString(maxItemLength))
    .max(maxItems)
    .superRefine((values, context) => {
      const seen = new Set<string>();

      values.forEach((value, index) => {
        const key = normalizedDuplicateKey(value);
        if (seen.has(key)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate normalized array value.",
            path: [index],
          });
        }
        seen.add(key);
      });
    });
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const deadlineSchema = nonBlankString(10).refine(isCalendarDate, {
  message: "Deadline must be a valid calendar date in YYYY-MM-DD form.",
});

export const jobExtractionV1Schema = z
  .object({
    contractVersion: z.literal(JOB_EXTRACTION_CONTRACT_VERSION),
    companyName: extractedField(
      nonBlankString(JOB_EXTRACTION_LIMITS.companyName),
    ),
    title: extractedField(nonBlankString(JOB_EXTRACTION_LIMITS.title)),
    location: extractedField(nonBlankString(JOB_EXTRACTION_LIMITS.location)),
    workMode: extractedField(z.enum(PRIVATE_JOB_WORK_MODES)),
    term: extractedField(nonBlankString(JOB_EXTRACTION_LIMITS.term)),
    deadline: extractedField(deadlineSchema),
    namedSkills: extractedField(
      uniqueStringArray(
        JOB_EXTRACTION_LIMITS.namedSkills.items,
        JOB_EXTRACTION_LIMITS.namedSkills.itemLength,
      ),
    ),
    responsibilities: extractedField(
      uniqueStringArray(
        JOB_EXTRACTION_LIMITS.responsibilities.items,
        JOB_EXTRACTION_LIMITS.responsibilities.itemLength,
      ),
    ),
    requirements: extractedField(
      uniqueStringArray(
        JOB_EXTRACTION_LIMITS.requirements.items,
        JOB_EXTRACTION_LIMITS.requirements.itemLength,
      ),
    ),
    overallConfidence: confidenceSchema,
  })
  .strict();

export type JobExtractionV1 = z.infer<typeof jobExtractionV1Schema>;

export type ParseJobExtractionResult =
  | {
      status: "valid";
      extraction: JobExtractionV1;
      canonicalRequirements: CanonicalJobRequirements;
      reviewClassification: JobExtractionReviewClassification;
    }
  | {
      status: "invalid";
      reason: "invalid_structured_output";
    };

export function parseJobExtractionOutput(
  providerOutput: unknown,
): ParseJobExtractionResult {
  const parsed = jobExtractionV1Schema.safeParse(providerOutput);

  if (!parsed.success) {
    return { status: "invalid", reason: "invalid_structured_output" };
  }

  return {
    status: "valid",
    extraction: parsed.data,
    canonicalRequirements: normalizeJobRequirements(parsed.data),
    reviewClassification: classifyJobExtractionConfidence(parsed.data),
  };
}
