import "server-only";

import type { PrivateJobExtractionActionResult } from "@/lib/ai/job-extraction-action-handler";

import type { FetchAndPersistOwnedJobUrlResult } from "./fetch-and-persist-owned-job-url";

export type FetchAndAnalyzeOwnedJobResult =
  | {
      status: "analysis_result";
      analysis: PrivateJobExtractionActionResult;
    }
  | Extract<
      FetchAndPersistOwnedJobUrlResult,
      {
        status:
          | "unauthenticated"
          | "job_unavailable"
          | "manual_paste_required"
          | "persistence_unavailable";
      }
    >;

export type FetchAndAnalyzeOwnedJobDependencies = {
  fetchAndPersist: (
    jobId: string,
  ) => Promise<FetchAndPersistOwnedJobUrlResult>;
  analyze: (jobId: string) => Promise<PrivateJobExtractionActionResult>;
};

export function createFetchAndAnalyzeOwnedJobHandler(
  dependencies: FetchAndAnalyzeOwnedJobDependencies,
): (jobId: string) => Promise<FetchAndAnalyzeOwnedJobResult> {
  return async function fetchAndAnalyzeOwnedJob(jobId) {
    let preparation: FetchAndPersistOwnedJobUrlResult;
    try {
      preparation = await dependencies.fetchAndPersist(jobId);
    } catch {
      return {
        status: "manual_paste_required",
        reason: "transport_unavailable",
      };
    }

    if (preparation.status !== "success") return preparation;

    let analysis: PrivateJobExtractionActionResult;
    try {
      analysis = await dependencies.analyze(jobId);
    } catch {
      analysis = {
        status: "provider_unavailable",
        creditResult: "refund_unavailable",
      };
    }
    return { status: "analysis_result", analysis };
  };
}
