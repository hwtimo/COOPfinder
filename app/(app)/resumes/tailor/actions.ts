"use server";

import { notFound, redirect } from "next/navigation";

import { getLoginHref } from "@/lib/auth/paths";
import { isUuid } from "@/lib/jobs/queries";
import { generateOwnedTailoredResume } from "@/lib/tailoring/generate-owned-tailored-resume";
import {
  mapTailoringGenerationActionOutcome,
  type TailoringGenerationActionState,
} from "@/lib/tailoring/tailoring-generation-action-state";

export async function generateTailoredResumeAction(
  jobId: string,
  idempotencyKey: string,
  _previousState: TailoringGenerationActionState,
): Promise<TailoringGenerationActionState> {
  void _previousState;
  if (!isUuid(jobId)) notFound();
  if (!isUuid(idempotencyKey)) {
    return {
      status: "error",
      message: "The generation request is invalid. Please try again.",
      retryable: true,
    };
  }

  let outcome;
  try {
    outcome = mapTailoringGenerationActionOutcome(
      await generateOwnedTailoredResume(jobId, idempotencyKey),
    );
  } catch {
    return {
      status: "error",
      message:
        "The tailored resume could not be generated. Please try again.",
      retryable: true,
    };
  }
  if (outcome.status === "redirect") redirect(outcome.href);
  if (outcome.status === "unauthenticated") {
    redirect(getLoginHref(`/resumes/tailor/${jobId}`));
  }
  if (outcome.status === "not_found") notFound();
  return outcome.status === "state"
    ? outcome.state
    : {
        status: "error",
        message: "The tailored resume could not be generated. Please try again.",
      };
}
