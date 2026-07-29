"use client";

import { CalendarCheck2, Eraser, Loader2 } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  updateApplicationInterviewDateAction,
  type UpdateApplicationInterviewDateActionResult,
} from "../actions";

export function ApplicationInterviewDateForm({
  applicationId,
  initialInterviewDate,
}: {
  applicationId: string;
  initialInterviewDate: string | null;
}) {
  const submittingRef = useRef(false);
  const persistedInterviewDate = initialInterviewDate ?? "";
  const [draft, setDraft] = useState({
    forInterviewDate: persistedInterviewDate,
    value: persistedInterviewDate,
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<UpdateApplicationInterviewDateActionResult | null>(null);
  const interviewDate =
    draft.forInterviewDate === persistedInterviewDate
      ? draft.value
      : persistedInterviewDate;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      setResult(
        await updateApplicationInterviewDateAction(
          applicationId,
          interviewDate,
        ),
      );
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
          htmlFor="application-interview-date"
          className="text-xs font-medium text-foreground"
        >
          Interview date
        </label>
        <input
          id="application-interview-date"
          type="date"
          value={interviewDate}
          onInput={(event) => {
            setDraft({
              forInterviewDate: persistedInterviewDate,
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
          disabled={pending || interviewDate.length === 0}
          onClick={() => {
            setDraft({
              forInterviewDate: persistedInterviewDate,
              value: "",
            });
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
            <CalendarCheck2 className="size-4" aria-hidden />
          )}
          {pending ? "Saving..." : "Save interview"}
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
