export type JobAnalysisFeedback = {
  tone: "success" | "error";
  message: string;
  refresh: boolean;
};

export type JobAnalysisRunResult =
  | { status: "completed"; feedback: JobAnalysisFeedback }
  | { status: "duplicate_ignored" };

export type JobAnalysisRunner = {
  isPending: () => boolean;
  submit: (jobId: string) => Promise<JobAnalysisRunResult>;
};

type JobAnalysisRunnerDependencies = {
  invoke: (jobId: string) => Promise<unknown>;
  refresh: () => void;
};

const GENERIC_FAILURE: JobAnalysisFeedback = {
  tone: "error",
  message: "The analysis could not be completed. Try again.",
  refresh: false,
};

export function jobAnalysisFeedback(result: unknown): JobAnalysisFeedback {
  if (typeof result !== "object" || result === null || !("status" in result)) {
    return GENERIC_FAILURE;
  }

  switch (result.status) {
    case "persisted":
      return {
        tone: "success",
        message: "Analysis saved. Review the extracted details before applying.",
        refresh: true,
      };
    case "already_persisted":
      return {
        tone: "success",
        message: "The saved analysis is already up to date.",
        refresh: true,
      };
    case "unauthenticated":
      return {
        tone: "error",
        message: "Log in again to analyze this job.",
        refresh: false,
      };
    case "job_unavailable":
    case "invalid_job_id":
      return {
        tone: "error",
        message: "This private job is no longer available.",
        refresh: false,
      };
    case "unsupported_source":
      return {
        tone: "error",
        message: "Analysis is available only for pasted job descriptions.",
        refresh: false,
      };
    case "invalid_job_text":
      return {
        tone: "error",
        message: "Add a valid job description before analyzing.",
        refresh: false,
      };
    case "configuration_unavailable":
      return {
        tone: "error",
        message: "AI analysis is not configured right now.",
        refresh: false,
      };
    case "provider_refusal":
      return {
        tone: "error",
        message: "The job description could not be analyzed. Review the text and try again.",
        refresh: false,
      };
    case "provider_unavailable":
      return {
        tone: "error",
        message: "AI analysis is temporarily unavailable. Try again.",
        refresh: false,
      };
    case "invalid_structured_output":
      return {
        tone: "error",
        message: "The analysis response could not be validated. Try again.",
        refresh: false,
      };
    case "persistence_unavailable":
      return {
        tone: "error",
        message: "The analysis could not be saved. Try again.",
        refresh: false,
      };
    case "persistence_rejected":
      return {
        tone: "error",
        message: "The analysis could not be saved because it was invalid. Try again.",
        refresh: false,
      };
    default:
      return GENERIC_FAILURE;
  }
}

export function createJobAnalysisRunner(
  dependencies: JobAnalysisRunnerDependencies,
): JobAnalysisRunner {
  let pending = false;

  return {
    isPending: () => pending,
    async submit(jobId) {
      if (pending) return { status: "duplicate_ignored" };
      pending = true;

      try {
        let actionResult: unknown;
        try {
          actionResult = await dependencies.invoke(jobId);
        } catch {
          actionResult = null;
        }

        const feedback = jobAnalysisFeedback(actionResult);
        if (feedback.refresh) {
          try {
            dependencies.refresh();
          } catch {
            // Persistence succeeded; a client refresh failure does not change it.
          }
        }

        return { status: "completed", feedback };
      } finally {
        pending = false;
      }
    },
  };
}
