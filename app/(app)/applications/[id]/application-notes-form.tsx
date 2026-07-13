"use client";

import { FormEvent, useRef, useState } from "react";
import { Eraser, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { APPLICATION_NOTES_MAX_LENGTH } from "@/lib/applications/update-notes";
import { cn } from "@/lib/utils";

import {
  updateApplicationNotesAction,
  type UpdateApplicationNotesActionResult,
} from "../actions";

export function ApplicationNotesForm({
  applicationId,
  initialNotes,
}: {
  applicationId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const persistedNotes = initialNotes ?? "";
  const [draft, setDraft] = useState({
    forNotes: persistedNotes,
    value: persistedNotes,
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<UpdateApplicationNotesActionResult | null>(null);
  const notes = draft.forNotes === persistedNotes ? draft.value : persistedNotes;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      const actionResult = await updateApplicationNotesAction(
        applicationId,
        notes,
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
        <label htmlFor="application-notes" className="sr-only">
          Application notes
        </label>
        <textarea
          id="application-notes"
          value={notes}
          onChange={(event) => {
            setDraft({ forNotes: persistedNotes, value: event.target.value });
            setResult(null);
          }}
          maxLength={APPLICATION_NOTES_MAX_LENGTH}
          rows={6}
          disabled={pending}
          placeholder="Add private application notes"
          className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Private to your account</span>
          <span className="tabular-nums">
            {notes.length.toLocaleString("en-CA")} /{" "}
            {APPLICATION_NOTES_MAX_LENGTH.toLocaleString("en-CA")}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-md"
          disabled={pending || notes.length === 0}
          onClick={() => {
            setDraft({ forNotes: persistedNotes, value: "" });
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
            <Save className="size-4" aria-hidden />
          )}
          {pending ? "Saving notes..." : "Save notes"}
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
