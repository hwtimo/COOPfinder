"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Loader2, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { createApplicationFromJobAction } from "@/app/(app)/applications/actions";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import type { ApplicationTrackingLink } from "@/lib/applications/types";

export function ApplicationTrackingControl({
  jobId,
  application,
}: {
  jobId: string;
  application: ApplicationTrackingLink | null | undefined;
}) {
  const submittingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (application === undefined) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 p-3">
        <p className="text-xs leading-5 text-muted-foreground">
          Application tracking is temporarily unavailable.
        </p>
      </div>
    );
  }

  if (application) {
    return (
      <div className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Application status</p>
          <div className="mt-1.5">
            <StatusBadge status={application.status} />
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 self-start">
          <Link href={`/applications/${application.id}`}>
            Open application
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  async function startTracking() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await createApplicationFromJobAction(jobId);
      if (
        (result.status === "created" || result.status === "already_exists") &&
        result.applicationId
      ) {
        window.location.assign(`/applications/${result.applicationId}`);
        return;
      }
      setMessage(result.message);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <Button
        type="button"
        size="sm"
        className="h-8"
        onClick={startTracking}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <Plus className="size-3" aria-hidden />
        )}
        {pending ? "Starting..." : "Start tracking"}
      </Button>
      {message ? (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
