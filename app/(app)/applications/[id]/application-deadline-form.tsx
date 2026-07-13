"use client";

import { FormEvent, useRef, useState } from "react";
import { CalendarClock, Eraser, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  updateApplicationDeadlineAction,
  type UpdateApplicationDeadlineActionResult,
} from "../actions";

export function ApplicationDeadlineForm({
  applicationId,
  initialDeadline,
}: {
  applicationId: string;
  initialDeadline: string | null;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const persistedDeadline = initialDeadline ?? "";
  const [draft, setDraft] = useState({
    forDeadline: persistedDeadline,
    value: persistedDeadline,
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<UpdateApplicationDeadlineActionResult | null>(null);
  const deadline =
    draft.forDeadline === persistedDeadline ? draft.value : persistedDeadline;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      const actionResult = await updateApplicationDeadlineAction(
        applicationId,
        deadline,
      );
      setResult(actionResult);
      if (
        actionResult.status === "updated" ||
        actionResult.status === "unchanged"
      ) {
        router.refresh();
      }
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const successful =
    result?.status === "updated" || result?.status === "unchanged";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label
          htmlFor="application-deadline"
          className="text-xs font-medium text-foreground"
        >
          Application deadline
        </label>
        <input
          id="application-deadline"
          type="date"
          value={deadline}
          onInput={(event) => {
            setDraft({
              forDeadline: persistedDeadline,
              value: event.currentTarget.value,
            });
            setResult(null);
          }}
          disabled={pending}
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-md"
          disabled={pending || deadline.length === 0}
          onClick={() => {
            setDraft({ forDeadline: persistedDeadline, value: "" });
            setResult(null);
          }}
        >
          <Eraser className="size-4" aria-hidden />
          Clear
        </Button>
        <Button type="submit" className="h-9 rounded-md" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CalendarClock className="size-4" aria-hidden />
          )}
          {pending ? "Saving..." : "Save deadline"}
        </Button>
      </div>

      {result ? (
        <p
          role="status"
          className={cn(
            "rounded-md border px-3 py-2 text-xs leading-5",
            successful
              ? "border-success/20 bg-success-soft text-success"
              : "border-destructive/20 bg-destructive-soft text-destructive",
          )}
        >
          {result.message}
        </p>
      ) : null}
    </form>
  );
}
