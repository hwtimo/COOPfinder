import {
  parseJobExtractionOutput,
  type JobExtractionV1,
} from "./schemas/job-extraction";
import type { JobExtractionReviewClassification } from "./job-extraction-confidence";

export type JobExtractionAnalysisViewModel =
  | { status: "not_generated" }
  | { status: "unavailable" }
  | {
      status: "ready";
      company: string | null;
      title: string | null;
      location: string | null;
      workMode: JobExtractionV1["workMode"]["value"];
      term: string | null;
      deadline: string | null;
      namedSkills: string[];
      responsibilities: string[];
      requirements: string[];
      overallConfidence: number;
      reviewClassification: JobExtractionReviewClassification;
    };

function isDefaultEmptyExtraction(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function isStoredConfidence(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

export function buildJobExtractionViewModel(
  storedExtraction: unknown,
  storedConfidence: unknown,
): JobExtractionAnalysisViewModel {
  if (storedExtraction === null || isDefaultEmptyExtraction(storedExtraction)) {
    return { status: "not_generated" };
  }

  const parsed = parseJobExtractionOutput(storedExtraction);
  if (parsed.status !== "valid") return { status: "unavailable" };

  const extraction = parsed.extraction;
  return {
    status: "ready",
    company: extraction.companyName.value,
    title: extraction.title.value,
    location: extraction.location.value,
    workMode: extraction.workMode.value,
    term: extraction.term.value,
    deadline: extraction.deadline.value,
    namedSkills: extraction.namedSkills.value ?? [],
    responsibilities: extraction.responsibilities.value ?? [],
    requirements: extraction.requirements.value ?? [],
    overallConfidence: isStoredConfidence(storedConfidence)
      ? storedConfidence
      : extraction.overallConfidence,
    reviewClassification: parsed.reviewClassification,
  };
}
