"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  APPLICATION_TRACKER_COLUMNS,
  getNextApplicationTrackerStatus,
  type ApplicationTrackerStatus,
} from "@/lib/applications/types";
import { cn } from "@/lib/utils";

import {
  updateApplicationStatusAction,
  type UpdateApplicationStatusActionResult,
} from "../actions";

const statusLabels = new Map<ApplicationTrackerStatus, string>(
  APPLICATION_TRACKER_COLUMNS.map((status) => [status.id, status.label]),
);

export function ApplicationStatusAdvance({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: ApplicationTrackerStatus;
}) {
  const nextStatus = getNextApplicationTrackerStatus(currentStatus);
  const nextLabel = nextStatus ? statusLabels.get(nextStatus) : null;
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] =
    useState<UpdateApplicationStatusActionResult | null>(null);

  if (!nextStatus || !nextLabel) return null;

  async function advance() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setResult(null);

    try {
      const actionResult = await updateApplicationStatusAction(
        applicationId,
        nextStatus,
      );
      setResult(actionResult);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  const successful =
    result?.status === "updated" || result?.status === "unchanged";

  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">Next status</p>
      <p className="mt-1 text-sm font-medium text-foreground">{nextLabel}</p>
      <Button
        type="button"
        className="mt-3 h-9 w-full rounded-md"
        disabled={pending}
        onClick={advance}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight className="size-4" aria-hidden />
        )}
        {pending ? "Advancing status..." : `Advance to ${nextLabel}`}
      </Button>
      {result ? (
        <p
          role="status"
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-xs leading-5",
            successful
              ? "border-success/20 bg-success-soft text-success"
              : "border-destructive/20 bg-destructive-soft text-destructive",
          )}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
