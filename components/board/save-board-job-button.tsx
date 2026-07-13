"use client";

import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useActionState, useMemo } from "react";

import { saveBoardJobAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { INITIAL_SAVE_BOARD_JOB_STATE } from "@/lib/jobs/forms";

export function SaveBoardJobButton({
  boardJobId,
  existingJobId,
}: {
  boardJobId: string;
  existingJobId?: string;
}) {
  const action = useMemo(
    () => saveBoardJobAction.bind(null, boardJobId),
    [boardJobId],
  );
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_SAVE_BOARD_JOB_STATE,
  );
  const savedJobId = state.jobId ?? existingJobId;

  if (savedJobId) {
    return (
      <div className="mt-4 rounded-md border border-success/25 bg-success-soft p-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">
              {state.alreadySaved || existingJobId
                ? "Already in My jobs"
                : "Saved to My jobs"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {state.message || "This role is stored in your private job list."}
            </p>
            <Link
              href={`/jobs/${savedJobId}`}
              className="mt-2 inline-flex text-xs font-medium text-brand hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open private job
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4">
      {state.status === "error" ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-destructive/20 bg-destructive-soft px-3 py-2 text-xs leading-5 text-foreground"
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="h-9 w-full rounded-md" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Saving privately
          </>
        ) : (
          "Save to My jobs"
        )}
      </Button>
    </form>
  );
}
