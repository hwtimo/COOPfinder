"use client";

import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  APPLICATION_TRACKER_COLUMNS,
  type ApplicationTrackerStatus,
} from "@/lib/applications/types";
import { cn } from "@/lib/utils";

import {
  updateApplicationStatusAction,
  type UpdateApplicationStatusActionResult,
} from "../actions";

export function ApplicationStatusForm({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: ApplicationTrackerStatus;
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [selection, setSelection] = useState({
    forStatus: currentStatus,
    value: currentStatus,
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<UpdateApplicationStatusActionResult | null>(null);
  const selectedStatus =
    selection.forStatus === currentStatus ? selection.value : currentStatus;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      const actionResult = await updateApplicationStatusAction(
        applicationId,
        selectedStatus,
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
          htmlFor="application-status"
          className="text-xs font-medium text-foreground"
        >
          Change status
        </label>
        <select
          id="application-status"
          value={selectedStatus}
          onChange={(event) => {
            setSelection({
              forStatus: currentStatus,
              value: event.target.value as ApplicationTrackerStatus,
            });
            setResult(null);
          }}
          disabled={pending}
          className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {APPLICATION_TRACKER_COLUMNS.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="submit"
        className="h-9 w-full rounded-md"
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
        {pending ? "Updating status..." : "Save status"}
      </Button>

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
