import "server-only";

import {
  parseJobExtractionOutput,
  type JobExtractionV1,
} from "./schemas/job-extraction";
import type { JobExtractionReviewClassification } from "./job-extraction-confidence";
import type { JobExtractionProvider } from "./job-extraction-provider";
import type { CanonicalJobRequirements } from "../jobs/job-requirement-normalization";
import { resolveAiModel, type AiModelResolution } from "./model-router";
import { openAIJobExtractionProvider } from "./openai-job-extraction-provider";

export const PRIVATE_JOB_DESCRIPTION_MAX_LENGTH = 100_000;

export type ExtractJobDescriptionResult =
  | {
      status: "success";
      extraction: JobExtractionV1;
      canonicalRequirements: CanonicalJobRequirements;
      reviewClassification: JobExtractionReviewClassification;
    }
  | {
      status: "invalid_input";
      reason: "input_not_string" | "input_empty" | "input_too_long";
      retryable: false;
    }
  | {
      status: "configuration_unavailable";
      reason: "model_not_configured" | "api_key_not_configured";
      retryable: false;
    }
  | {
      status: "provider_refusal";
      reason: "provider_refusal";
      retryable: false;
    }
  | {
      status: "invalid_structured_output";
      reason: "invalid_structured_output";
      retryable: false;
    }
  | {
      status: "provider_unavailable";
      reason: "provider_unavailable";
      retryable: true;
    };

type ExtractionServiceDependencies = {
  resolveModel?: () => AiModelResolution;
  provider?: JobExtractionProvider;
};

export async function extractJobDescription(
  input: unknown,
  dependencies: ExtractionServiceDependencies = {},
): Promise<ExtractJobDescriptionResult> {
  if (typeof input !== "string") {
    return {
      status: "invalid_input",
      reason: "input_not_string",
      retryable: false,
    };
  }

  if (input.length > PRIVATE_JOB_DESCRIPTION_MAX_LENGTH) {
    return {
      status: "invalid_input",
      reason: "input_too_long",
      retryable: false,
    };
  }

  const jobDescription = input.trim();
  if (!jobDescription) {
    return {
      status: "invalid_input",
      reason: "input_empty",
      retryable: false,
    };
  }

  const resolveModel =
    dependencies.resolveModel ?? (() => resolveAiModel("job_extraction"));
  const modelResolution = resolveModel();
  if (modelResolution.status !== "ready") {
    return {
      status: "configuration_unavailable",
      reason: "model_not_configured",
      retryable: false,
    };
  }

  let providerResult;
  try {
    providerResult = await (
      dependencies.provider ?? openAIJobExtractionProvider
    ).extract({
      model: modelResolution.model,
      jobDescription,
    });
  } catch {
    return {
      status: "provider_unavailable",
      reason: "provider_unavailable",
      retryable: true,
    };
  }

  if (providerResult.status === "configuration_unavailable") {
    return {
      status: "configuration_unavailable",
      reason: "api_key_not_configured",
      retryable: false,
    };
  }

  if (providerResult.status === "refusal") {
    return {
      status: "provider_refusal",
      reason: "provider_refusal",
      retryable: false,
    };
  }

  if (providerResult.status === "unavailable") {
    return {
      status: "provider_unavailable",
      reason: "provider_unavailable",
      retryable: true,
    };
  }

  const canonicalResult = parseJobExtractionOutput(providerResult.output);
  if (canonicalResult.status !== "valid") {
    return {
      status: "invalid_structured_output",
      reason: "invalid_structured_output",
      retryable: false,
    };
  }

  return {
    status: "success",
    extraction: canonicalResult.extraction,
    canonicalRequirements: canonicalResult.canonicalRequirements,
    reviewClassification: canonicalResult.reviewClassification,
  };
}
