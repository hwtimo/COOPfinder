import type { PrivateJobExtractionActionResult } from "@/lib/ai/job-extraction-action-handler";
import { jobAnalysisFeedback } from "@/lib/ai/job-analysis-control";

import type { FetchAndAnalyzeOwnedJobResult } from "./fetch-and-analyze-owned-job";

export type JobUrlFetchAnalysisFeedback = {
  tone: "success" | "error";
  message: string;
  fetched: boolean;
  refresh: boolean;
};

export type JobUrlFetchAnalysisRunner = {
  isPending: () => boolean;
  submit: (
    jobId: string,
  ) => Promise<
    | { status: "completed"; feedback: JobUrlFetchAnalysisFeedback }
    | { status: "duplicate_ignored" }
  >;
};

export type JobUrlFetchAnalysisRunnerDependencies = {
  invoke: (jobId: string) => Promise<unknown>;
  refresh: () => void;
};

const MANUAL_FALLBACK_MESSAGES = {
  source_unavailable: "The saved URL is unavailable.",
  blocked_url: "The saved URL cannot be fetched safely.",
  redirect: "The saved page redirects, and redirects are not followed.",
  timeout: "The saved page took too long to respond.",
  oversized_body: "The saved page is too large to process safely.",
  unsupported_content: "The saved page is not supported HTML or plain text.",
  http_failure: "The saved page could not be retrieved.",
  empty_text: "The saved page did not contain readable job text.",
  transport_unavailable: "URL retrieval is temporarily unavailable.",
} as const;

function fetchedAnalysisFeedback(
  analysis: PrivateJobExtractionActionResult,
): JobUrlFetchAnalysisFeedback {
  const feedback = jobAnalysisFeedback(analysis);
  const succeeded =
    analysis.status === "persisted" || analysis.status === "already_persisted";
  return {
    tone: feedback.tone,
    message: succeeded
      ? feedback.message
      : `The job description was fetched and saved. ${feedback.message}`,
    fetched: true,
    refresh: succeeded,
  };
}

export function jobUrlFetchAnalysisFeedback(
  value: unknown,
): JobUrlFetchAnalysisFeedback {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return {
      tone: "error",
      message:
        "The saved URL could not be prepared. Paste the job description instead. No parser credit was used.",
      fetched: false,
      refresh: false,
    };
  }

  const result = value as FetchAndAnalyzeOwnedJobResult;
  if (result.status === "analysis_result") {
    return fetchedAnalysisFeedback(result.analysis);
  }
  if (result.status === "unauthenticated") {
    return {
      tone: "error",
      message: "Log in again to fetch and analyze this private job.",
      fetched: false,
      refresh: false,
    };
  }
  if (result.status === "job_unavailable") {
    return {
      tone: "error",
      message: "This private job is no longer available.",
      fetched: false,
      refresh: false,
    };
  }
  if (result.status === "persistence_unavailable") {
    return {
      tone: "error",
      message:
        "The fetched description could not be saved. Paste the job description instead. No parser credit was used.",
      fetched: false,
      refresh: false,
    };
  }
  if (result.status !== "manual_paste_required") {
    return {
      tone: "error",
      message:
        "The saved URL could not be prepared. Paste the job description instead. No parser credit was used.",
      fetched: false,
      refresh: false,
    };
  }

  if (
    typeof result.reason !== "string" ||
    !(result.reason in MANUAL_FALLBACK_MESSAGES)
  ) {
    return {
      tone: "error",
      message:
        "The saved URL could not be prepared. Paste the job description instead. No parser credit was used.",
      fetched: false,
      refresh: false,
    };
  }
  const reason = result.reason as keyof typeof MANUAL_FALLBACK_MESSAGES;
  return {
    tone: "error",
    message: `${MANUAL_FALLBACK_MESSAGES[reason]} Paste the job description instead. No parser credit was used.`,
    fetched: false,
    refresh: false,
  };
}

export function createJobUrlFetchAnalysisRunner(
  dependencies: JobUrlFetchAnalysisRunnerDependencies,
): JobUrlFetchAnalysisRunner {
  let pending = false;
  return {
    isPending: () => pending,
    async submit(jobId) {
      if (pending) return { status: "duplicate_ignored" };
      pending = true;
      try {
        let result: unknown;
        try {
          result = await dependencies.invoke(jobId);
        } catch {
          result = null;
        }
        const feedback = jobUrlFetchAnalysisFeedback(result);
        if (feedback.refresh) {
          try {
            dependencies.refresh();
          } catch {
            // Analysis already persisted; refresh failure must not alter it.
          }
        }
        return { status: "completed", feedback };
      } finally {
        pending = false;
      }
    },
  };
}
