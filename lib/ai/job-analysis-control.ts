export type JobAnalysisFeedback = {
  tone: "success" | "error";
  message: string;
  creditMessage: string;
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
  creditMessage: "Refund status is unavailable. Do not assume a refund.",
  refresh: false,
};

const CREDIT_MESSAGES = {
  used: "One analysis credit was used.",
  not_used: "No analysis credit was used.",
  refunded: "The analysis credit was refunded.",
  refund_unavailable: "Refund status is unavailable. Do not assume a refund.",
} as const;

export function jobAnalysisFeedback(result: unknown): JobAnalysisFeedback {
  if (
    typeof result !== "object" ||
    result === null ||
    !("status" in result) ||
    !("creditResult" in result) ||
    typeof result.creditResult !== "string" ||
    !(result.creditResult in CREDIT_MESSAGES)
  ) {
    return GENERIC_FAILURE;
  }

  const creditMessage =
    CREDIT_MESSAGES[result.creditResult as keyof typeof CREDIT_MESSAGES];

  switch (result.status) {
    case "persisted":
      return {
        tone: "success",
        message: "Analysis saved. Review the extracted details before applying.",
        creditMessage,
        refresh: true,
      };
    case "already_persisted":
      return {
        tone: "success",
        message: "The saved analysis is already up to date.",
        creditMessage,
        refresh: true,
      };
    case "unauthenticated":
      return {
        tone: "error",
        message: "Log in again to analyze this job.",
        creditMessage,
        refresh: false,
      };
    case "job_unavailable":
    case "invalid_job_id":
      return {
        tone: "error",
        message: "This private job is no longer available.",
        creditMessage,
        refresh: false,
      };
    case "unsupported_source":
      return {
        tone: "error",
        message: "Analysis is available only for pasted job descriptions.",
        creditMessage,
        refresh: false,
      };
    case "no_credits":
      return {
        tone: "error",
        message: "You have used your available job analyses.",
        creditMessage,
        refresh: false,
      };
    case "daily_limit":
      return {
        tone: "error",
        message: "You have reached the rolling 24-hour analysis attempt limit. Try again later.",
        creditMessage,
        refresh: false,
      };
    case "credit_unavailable":
      return {
        tone: "error",
        message: "Analysis credits are temporarily unavailable. Try again.",
        creditMessage,
        refresh: false,
      };
    case "invalid_job_text":
      return {
        tone: "error",
        message: "Add a valid job description before analyzing.",
        creditMessage,
        refresh: false,
      };
    case "configuration_unavailable":
      return {
        tone: "error",
        message: "AI analysis is not configured right now.",
        creditMessage,
        refresh: false,
      };
    case "provider_refusal":
      return {
        tone: "error",
        message: "The job description could not be analyzed. Review the text and try again.",
        creditMessage,
        refresh: false,
      };
    case "provider_unavailable":
      return {
        tone: "error",
        message: "AI analysis is temporarily unavailable. Try again.",
        creditMessage,
        refresh: false,
      };
    case "invalid_structured_output":
      return {
        tone: "error",
        message: "The analysis response could not be validated. Try again.",
        creditMessage,
        refresh: false,
      };
    case "persistence_unavailable":
      return {
        tone: "error",
        message: "The analysis could not be saved. Try again.",
        creditMessage,
        refresh: false,
      };
    case "persistence_rejected":
      return {
        tone: "error",
        message: "The analysis could not be saved because it was invalid. Try again.",
        creditMessage,
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
