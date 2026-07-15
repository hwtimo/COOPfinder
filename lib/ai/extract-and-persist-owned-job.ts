import "server-only";

import {
  extractOwnedJobDescription,
  type ExtractOwnedJobDescriptionResult,
} from "./extract-owned-job-description";
import {
  persistJobExtraction,
  type PersistJobExtractionResult,
} from "./persist-job-extraction";
import type { JobExtractionV1 } from "./schemas/job-extraction";

export type ExtractAndPersistOwnedJobDependencies = {
  extractOwnedJob: (
    jobId: string,
  ) => Promise<ExtractOwnedJobDescriptionResult>;
  persistExtraction: (
    jobId: string,
    extraction: JobExtractionV1,
  ) => Promise<PersistJobExtractionResult>;
};

export type ExtractAndPersistOwnedJobResult =
  | { status: "persisted" }
  | { status: "already_persisted" }
  | { status: "unauthenticated" }
  | { status: "invalid_job_id" }
  | { status: "job_unavailable" }
  | { status: "unsupported_source" }
  | { status: "configuration_unavailable" }
  | { status: "provider_refusal" }
  | { status: "provider_unavailable" }
  | { status: "invalid_structured_output" }
  | { status: "invalid_job_text" }
  | { status: "persistence_unavailable" }
  | { status: "persistence_rejected" };

export function createExtractAndPersistOwnedJob(
  dependencies: ExtractAndPersistOwnedJobDependencies,
): (jobId: string) => Promise<ExtractAndPersistOwnedJobResult> {
  return async function orchestrateExtractionPersistence(jobId) {
    let extractionResult: ExtractOwnedJobDescriptionResult;
    try {
      extractionResult = await dependencies.extractOwnedJob(jobId);
    } catch {
      return { status: "provider_unavailable" };
    }

    switch (extractionResult.status) {
      case "unauthenticated":
        return { status: "unauthenticated" };
      case "invalid_job_id":
        return { status: "invalid_job_id" };
      case "job_unavailable":
        return { status: "job_unavailable" };
      case "unsupported_intake_source":
        return { status: "unsupported_source" };
      case "configuration_unavailable":
        return { status: "configuration_unavailable" };
      case "provider_refusal":
        return { status: "provider_refusal" };
      case "provider_unavailable":
        return { status: "provider_unavailable" };
      case "invalid_structured_output":
        return { status: "invalid_structured_output" };
      case "missing_job_description":
      case "invalid_input":
        return { status: "invalid_job_text" };
      case "success":
        break;
    }

    let persistenceResult: PersistJobExtractionResult;
    try {
      persistenceResult = await dependencies.persistExtraction(
        jobId,
        extractionResult.extraction,
      );
    } catch {
      return { status: "persistence_unavailable" };
    }

    switch (persistenceResult.status) {
      case "updated":
        return { status: "persisted" };
      case "unchanged":
        return { status: "already_persisted" };
      case "unavailable":
        return { status: "job_unavailable" };
      case "unsupported_source":
        return { status: "unsupported_source" };
      case "invalid_input":
        return { status: "persistence_rejected" };
      case "persistence_unavailable":
        return { status: "persistence_unavailable" };
    }
  };
}

const productionOrchestrator = createExtractAndPersistOwnedJob({
  extractOwnedJob: extractOwnedJobDescription,
  persistExtraction: persistJobExtraction,
});

export async function extractAndPersistOwnedJob(
  jobId: string,
): Promise<ExtractAndPersistOwnedJobResult> {
  return productionOrchestrator(jobId);
}
