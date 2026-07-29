"use client";

import { startTransition, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { extractAndPersistPrivateJobAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import {
  createJobAnalysisRunner,
  type JobAnalysisFeedback,
  type JobAnalysisRunner,
} from "@/lib/ai/job-analysis-control";
import { cn } from "@/lib/utils";

export function JobAnalysisControl({
  jobId,
  hasSavedAnalysis,
}: {
  jobId: string;
  hasSavedAnalysis: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<JobAnalysisFeedback | null>(null);
  const runner = useMemo<JobAnalysisRunner>(
    () =>
      createJobAnalysisRunner({
        invoke: extractAndPersistPrivateJobAction,
        refresh: () => router.refresh(),
      }),
    [router],
  );

  function analyze() {
    if (runner.isPending()) return;

    setPending(true);
    setFeedback(null);

    startTransition(() => {
      void runner.submit(jobId).then((result) => {
        if (result.status === "completed") setFeedback(result.feedback);
        setPending(false);
      });
    });
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <Button
        type="button"
        className="h-9 rounded-md"
        onClick={analyze}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {pending
          ? "Analysis in progress..."
          : hasSavedAnalysis
            ? "Analyze again"
            : "Analyze job description"}
      </Button>

      {pending ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-brand/20 bg-brand-soft/30 px-3 py-3 text-xs leading-5 text-text-secondary"
        >
          <p className="font-semibold text-foreground">
            Already analyzing — this won’t use another credit.
          </p>
          <p className="mt-1">
            The server completes these steps in order; exact step timing is not
            reported.
          </p>
          <ol className="mt-2 space-y-1" aria-label="Analysis progress">
            <li>1. Check the saved job and analysis credit.</li>
            <li>2. Analyze and validate the saved job description.</li>
            <li>3. Save verified analysis and finalize the credit.</li>
          </ol>
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={cn(
            "rounded-md border px-3 py-2 text-xs leading-5",
            feedback.tone === "success"
              ? "border-success/20 bg-success-soft text-success"
              : "border-destructive/20 bg-destructive-soft text-destructive",
          )}
        >
          <p>{feedback.message}</p>
          <p className="mt-1 font-medium">{feedback.creditMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
