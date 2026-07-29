"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchAndAnalyzeSavedJobAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import {
  createJobUrlFetchAnalysisRunner,
  type JobUrlFetchAnalysisFeedback,
  type JobUrlFetchAnalysisRunner,
} from "@/lib/jobs/job-url-fetch-analysis-control";
import { cn } from "@/lib/utils";

export function JobUrlFetchAnalysisControl({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] =
    useState<JobUrlFetchAnalysisFeedback | null>(null);
  const runner = useMemo<JobUrlFetchAnalysisRunner>(
    () =>
      createJobUrlFetchAnalysisRunner({
        invoke: fetchAndAnalyzeSavedJobAction,
        refresh: () => router.refresh(),
      }),
    [router],
  );

  function submit() {
    if (runner.isPending()) return;
    setPending(true);
    setFeedback(null);
    void runner.submit(jobId).then((result) => {
      if (result.status === "completed") setFeedback(result.feedback);
      setPending(false);
    });
  }

  return (
    <div className="rounded-md border border-brand/20 bg-brand-soft/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Prepare this saved URL
      </h3>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        InternshipBC makes one bounded retrieval attempt, saves readable text
        privately, then uses the existing credit-enforced analysis. Failed
        retrievals use no parser credit.
      </p>

      <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          className="h-9 rounded-md"
          onClick={submit}
          disabled={pending || feedback?.fetched}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {pending ? "Fetching saved URL..." : "Fetch and analyze"}
        </Button>

        {feedback?.fetched && !feedback.refresh ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-md"
            onClick={() => router.refresh()}
          >
            <RefreshCw className="size-4" aria-hidden />
            Continue with saved description
          </Button>
        ) : null}
      </div>

      {feedback ? (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-xs leading-5",
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
