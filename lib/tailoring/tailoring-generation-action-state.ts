import type { GenerateOwnedTailoredResumeResult } from "./generate-owned-tailored-resume";

export type TailoringGenerationActionState = Readonly<{
  status: "idle" | "pending" | "error";
  message: string;
  creditMessage: string;
  retryable?: boolean;
}>;

export const INITIAL_TAILORING_GENERATION_ACTION_STATE: TailoringGenerationActionState =
  Object.freeze({ status: "idle", message: "", creditMessage: "" });

export type TailoringGenerationActionOutcome =
  | Readonly<{ status: "redirect"; href: string }>
  | Readonly<{ status: "unauthenticated" | "not_found" }>
  | Readonly<{
      status: "state";
      state: TailoringGenerationActionState;
    }>;

export function mapTailoringGenerationActionOutcome(
  result: GenerateOwnedTailoredResumeResult,
): TailoringGenerationActionOutcome {
  const creditMessages = {
    used: "One tailoring credit was used.",
    not_used: "No tailoring credit was used.",
    refunded: "The tailoring credit was refunded.",
    refund_unavailable:
      "Refund status is unavailable. Do not assume a refund.",
  } as const;
  const creditMessage = creditMessages[result.creditResult];

  if (result.status === "generated" || result.status === "already_completed") {
    return {
      status: "redirect",
      href: `/resumes/versions/${result.resumeVersionId}`,
    };
  }
  if (result.status === "unauthenticated" || result.status === "not_found") {
    return { status: result.status };
  }
  if (result.status === "generation_in_progress") {
    return {
      status: "state",
      state: {
        status: "pending",
        message: "Already generating — this won’t use another credit.",
        creditMessage,
      },
    };
  }
  if (result.status === "insufficient_credit") {
    return {
      status: "state",
      state: {
        status: "error",
        message:
          "You do not have enough tailoring credits to generate this resume.",
        creditMessage,
      },
    };
  }
  if (result.status === "rate_limited") {
    return {
      status: "state",
      state: {
        status: "error",
        message:
          "Tailored resume generation is temporarily limited. Please try again later.",
        creditMessage,
        retryable: false,
      },
    };
  }
  if (result.status === "configuration_unavailable") {
    return {
      status: "state",
      state: {
        status: "error",
        message:
          "Tailored resume generation is not available right now. Please try again later.",
        creditMessage,
        retryable: false,
      },
    };
  }

  const guidance = {
    extraction_unavailable:
      "Analyze this job before generating a tailored resume.",
    profile_unavailable:
      "Update your Master Profile before generating a tailored resume.",
    invalid_extraction:
      "This saved analysis is not available for tailoring.",
    insufficient_job_data:
      "This job does not have enough structured information for tailoring.",
    insufficient_candidate_data:
      "Add approved bullets and structured evidence to your Master Profile before generating.",
  } as const;
  if (result.status in guidance) {
    return {
      status: "state",
      state: {
        status: "error",
        message: guidance[result.status as keyof typeof guidance],
        creditMessage,
      },
    };
  }

  return {
    status: "state",
    state: {
      status: "error",
      message:
        "The tailored resume could not be generated. Please try again.",
      creditMessage,
      retryable: true,
    },
  };
}
