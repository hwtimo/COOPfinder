import type { JobExtractionV1 } from "./schemas/job-extraction";

export const JOB_EXTRACTION_CONFIDENCE_THRESHOLDS = {
  lowConfidence: 0.4,
  normalReview: 0.75,
} as const;

export type JobExtractionReviewClassification =
  | "normal_review"
  | "low_confidence_review"
  | "manual_review";

type ConfidenceClassificationInput = Pick<
  JobExtractionV1,
  "companyName" | "title" | "overallConfidence"
>;

export function classifyJobExtractionConfidence({
  companyName,
  title,
  overallConfidence,
}: ConfidenceClassificationInput): JobExtractionReviewClassification {
  if (!companyName.value?.trim() || !title.value?.trim()) {
    return "manual_review";
  }

  if (overallConfidence >= JOB_EXTRACTION_CONFIDENCE_THRESHOLDS.normalReview) {
    return "normal_review";
  }

  if (overallConfidence >= JOB_EXTRACTION_CONFIDENCE_THRESHOLDS.lowConfidence) {
    return "low_confidence_review";
  }

  return "manual_review";
}
