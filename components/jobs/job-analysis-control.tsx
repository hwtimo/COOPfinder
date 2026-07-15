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
    <div className="flex flex-col items-start gap-2 border-t pt-4 sm:flex-row sm:items-center">
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
          ? "Analyzing job description..."
          : hasSavedAnalysis
            ? "Analyze again"
            : "Analyze job description"}
      </Button>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "rounded-md border px-3 py-2 text-xs leading-5",
            feedback.tone === "success"
              ? "border-success/20 bg-success-soft text-success"
              : "border-destructive/20 bg-destructive-soft text-destructive",
          )}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
