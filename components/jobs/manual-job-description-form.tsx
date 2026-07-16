"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { saveManualJobDescriptionAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { INITIAL_MANUAL_JOB_DESCRIPTION_STATE } from "@/lib/jobs/forms";
import {
  MANUAL_JOB_DESCRIPTION_EXPLANATION,
  MANUAL_JOB_DESCRIPTION_HEADING,
  PRIVATE_JOB_DESCRIPTION_MAX_LENGTH,
} from "@/lib/jobs/job-url-intake";

export function ManualJobDescriptionForm({
  jobId,
  sourceUrl,
}: {
  jobId: string;
  sourceUrl: string | null;
}) {
  const router = useRouter();
  const action = useMemo(
    () => saveManualJobDescriptionAction.bind(null, jobId),
    [jobId],
  );
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_MANUAL_JOB_DESCRIPTION_STATE,
  );

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  return (
    <div className="rounded-md border border-brand/20 bg-brand-soft/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {MANUAL_JOB_DESCRIPTION_HEADING}
      </h3>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        {MANUAL_JOB_DESCRIPTION_EXPLANATION}
      </p>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View saved source URL
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}

      <form action={formAction} className="mt-4 space-y-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-foreground">
            Job description
          </span>
          <textarea
            name="rawText"
            required
            maxLength={PRIVATE_JOB_DESCRIPTION_MAX_LENGTH}
            rows={8}
            disabled={pending || state.status === "success"}
            aria-invalid={
              state.status !== "idle" && state.status !== "success"
            }
            className="min-h-40 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Paste the complete job description here"
          />
        </label>

        {state.status !== "idle" ? (
          <p
            role="status"
            className={
              state.status === "success"
                ? "text-xs leading-5 text-success"
                : "text-xs leading-5 text-destructive"
            }
          >
            {state.message}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-9 rounded-md"
          disabled={pending || state.status === "success"}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving description
            </>
          ) : (
            "Save description"
          )}
        </Button>
      </form>
    </div>
  );
}
