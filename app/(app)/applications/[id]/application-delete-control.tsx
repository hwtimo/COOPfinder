"use client";

import { FormEvent, useRef, useState } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  deleteApplicationAction,
  type DeleteApplicationActionResult,
} from "../actions";

export function ApplicationDeleteControl({
  applicationId,
}: {
  applicationId: string;
}) {
  const submittingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<DeleteApplicationActionResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      const actionResult = await deleteApplicationAction(applicationId);
      setResult(actionResult);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="destructive"
        className="h-9 w-full justify-start rounded-md"
        onClick={() => {
          setResult(null);
          setConfirming(true);
        }}
      >
        <Trash2 className="size-4" aria-hidden />
        Delete application
      </Button>
    );
  }

  const failed = result && result.status !== "deleted";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-md border border-destructive/20 bg-destructive-soft p-3"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Delete this application?
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            This permanently removes the application tracking record and its
            timeline. The saved job remains in My jobs.
          </p>
        </div>
      </div>

      {failed ? (
        <p
          role="alert"
          className={cn(
            "rounded-md border bg-background px-3 py-2 text-xs text-destructive",
            "border-destructive/20",
          )}
        >
          {result.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-md"
          onClick={() => {
            setConfirming(false);
            setResult(null);
          }}
          disabled={pending}
        >
          <X className="size-4" aria-hidden />
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          className="h-9 rounded-md"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          {pending ? "Deleting..." : "Confirm delete"}
        </Button>
      </div>
    </form>
  );
}
