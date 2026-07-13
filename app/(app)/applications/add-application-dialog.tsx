"use client";

import Link from "next/link";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { EligibleApplicationJob } from "@/lib/applications/types";
import { cn } from "@/lib/utils";

import {
  createApplicationFromJobAction,
  type CreateApplicationActionResult,
} from "./actions";

export function AddApplicationDialog({
  eligibleJobs,
  savedJobCount,
  disabledReason,
}: {
  eligibleJobs: EligibleApplicationJob[];
  savedJobCount: number;
  disabledReason?: string;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const submittingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [result, setResult] = useState<CreateApplicationActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const selectedJob = eligibleJobs.find((job) => job.id === selectedJobId);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    selectRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, pending]);

  function openDialog() {
    setResult(null);
    setSelectedJobId("");
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJob || submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);

    try {
      const actionResult = await createApplicationFromJobAction(selectedJob.id);
      setResult(actionResult);
      if (
        actionResult.status === "created" ||
        actionResult.status === "already_exists"
      ) {
        setSelectedJobId("");
        window.setTimeout(() => window.location.reload(), 750);
      }
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="h-9 rounded-md"
        disabled={Boolean(disabledReason)}
        title={disabledReason}
        onClick={openDialog}
      >
        <Plus className="size-3.5" aria-hidden />
        Add application
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !pending) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-application-title"
            className="w-full max-w-md rounded-lg border bg-card shadow-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 id="add-application-title" className="text-base font-semibold">
                  Add application
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start tracking one of your private saved jobs.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-md"
                onClick={() => setOpen(false)}
                disabled={pending}
                title="Close"
                aria-label="Close add application dialog"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </header>

            <div className="px-5 py-5">
              {result ? (
                <div
                  role="status"
                  className={cn(
                    "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                    result.status === "created" || result.status === "already_exists"
                      ? "border-success/20 bg-success-soft text-success"
                      : "border-destructive/20 bg-destructive-soft text-destructive",
                  )}
                >
                  {result.status === "created" || result.status === "already_exists" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <span>{result.message}</span>
                </div>
              ) : null}

              {eligibleJobs.length > 0 ? (
                <form onSubmit={submit}>
                  <label
                    htmlFor="application-job"
                    className="text-xs font-medium text-foreground"
                  >
                    Saved job
                  </label>
                  <select
                    ref={selectRef}
                    id="application-job"
                    value={selectedJob?.id ?? ""}
                    onChange={(event) => {
                      setSelectedJobId(event.target.value);
                      setResult(null);
                    }}
                    disabled={pending}
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                  >
                    <option value="">Choose a saved job</option>
                    {eligibleJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.companyName ?? "Company not added"} - {job.title}
                      </option>
                    ))}
                  </select>

                  {selectedJob ? (
                    <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{selectedJob.title}</p>
                      <p className="mt-1">
                        {[selectedJob.companyName ?? "Company not added", selectedJob.location, selectedJob.workMode]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-md"
                      onClick={() => setOpen(false)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 rounded-md"
                      disabled={!selectedJob || pending}
                    >
                      {pending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Plus className="size-3.5" aria-hidden />
                      )}
                      {pending ? "Adding..." : "Start tracking"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="py-3 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-muted">
                    <BriefcaseBusiness className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">
                    {savedJobCount > 0
                      ? "All saved jobs are already tracked"
                      : "No saved jobs to track"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                    {savedJobCount > 0
                      ? "Each private saved job already has an application."
                      : "Save a private job before creating an application."}
                  </p>
                  <Button asChild size="sm" className="mt-4 h-9 rounded-md">
                    <Link href="/jobs">View saved jobs</Link>
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
