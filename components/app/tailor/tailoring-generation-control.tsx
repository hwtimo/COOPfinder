"use client";

import { Loader2, WandSparkles } from "lucide-react";
import { useActionState, useCallback, useRef } from "react";

import { generateTailoredResumeAction } from "@/app/(app)/resumes/tailor/actions";
import { CardSection } from "@/components/app/card-section";
import { Button } from "@/components/ui/button";
import {
  INITIAL_TAILORING_GENERATION_ACTION_STATE,
} from "@/lib/tailoring/tailoring-generation-action-state";

export function TailoringGenerationControl({
  jobId,
  availableCredits,
  initialIdempotencyKey,
  canGenerate,
}: {
  jobId: string;
  availableCredits: number | null;
  initialIdempotencyKey: string;
  canGenerate: boolean;
}) {
  const idempotencyKey = useRef(initialIdempotencyKey);
  const submitting = useRef(false);
  const action = useCallback(
    async (previousState: typeof INITIAL_TAILORING_GENERATION_ACTION_STATE) => {
      if (submitting.current) {
        return {
          status: "pending" as const,
          message: "Already generating — this won’t use another credit.",
          creditMessage: "No additional tailoring credit was used.",
        };
      }
      submitting.current = true;
      try {
        const nextState = await generateTailoredResumeAction(
          jobId,
          idempotencyKey.current,
          previousState,
        );
        if (nextState.retryable) idempotencyKey.current = crypto.randomUUID();
        return nextState;
      } finally {
        submitting.current = false;
      }
    },
    [jobId],
  );
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_TAILORING_GENERATION_ACTION_STATE,
  );
  return (
    <CardSection
      title="Tailoring credits and generation"
      description="Generation costs exactly 1 tailoring credit."
    >
      <div className="rounded-md border bg-background p-4">
        <p className="text-sm font-medium text-foreground">
          {availableCredits === null
            ? "Available balance is temporarily unavailable."
            : `${availableCredits} tailoring ${availableCredits === 1 ? "credit" : "credits"} available`}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {canGenerate
            ? "Only approved Master Profile bullets and structured evidence can be selected. Unsupported claims will not be added."
            : "Generation becomes available when the tailoring preflight is ready."}
        </p>
        {canGenerate ? (
          <form action={formAction} className="mt-4">
            <Button
              type="submit"
              size="lg"
              className="h-10 rounded-md"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Generation in progress...
                </>
              ) : (
                <>
                  <WandSparkles className="size-4" aria-hidden />
                  Generate tailored resume
                </>
              )}
            </Button>
          </form>
        ) : null}
        {pending ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 rounded-md border border-brand/20 bg-brand-soft/30 px-3 py-3 text-xs leading-5 text-text-secondary"
          >
            <p className="font-semibold text-foreground">
              Already generating — this won’t use another credit.
            </p>
            <p className="mt-1">
              The server completes these steps in order; exact step timing is
              not reported.
            </p>
            <ol className="mt-2 space-y-1" aria-label="Generation progress">
              <li>1. Check the job, approved evidence, and tailoring credit.</li>
              <li>2. Generate and validate the tailored resume.</li>
              <li>3. Save the immutable version and finalize the credit.</li>
            </ol>
          </div>
        ) : null}
        {state.status !== "idle" ? (
          <div
            role="status"
            className={
              state.status === "error"
                ? "mt-3 text-sm text-destructive"
                : "mt-3 text-sm text-muted-foreground"
            }
          >
            <p>{state.message}</p>
            <p className="mt-1 font-medium">{state.creditMessage}</p>
          </div>
        ) : null}
      </div>
    </CardSection>
  );
}
