"use client";

import { Loader2, PencilLine, Trash2, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { deletePrivateJobAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { INITIAL_DELETE_PRIVATE_JOB_STATE } from "@/lib/jobs/forms";
import type { PrivateJob } from "@/lib/jobs/types";

import { EditPrivateJobModal } from "./private-job-form-modal";

function DeletePrivateJobDialog({
  job,
  onClose,
}: {
  job: PrivateJob;
  onClose: () => void;
}) {
  const action = useMemo(
    () => deletePrivateJobAction.bind(null, job.id),
    [job.id],
  );
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_DELETE_PRIVATE_JOB_STATE,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-private-job-title"
        className="w-full max-w-md rounded-lg border bg-card"
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 id="delete-private-job-title" className="text-base font-semibold">
              Delete private job?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {job.companyName ?? "Company not listed"} · {job.title}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close delete confirmation"
            className="rounded-md"
            onClick={onClose}
            disabled={pending}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <form action={formAction} className="space-y-4 p-5">
          <p className="text-sm leading-6 text-text-secondary">
            This removes the saved job. COOPfinder will refuse the deletion if
            a linked application exists, protecting its application history.
          </p>

          {state.status === "error" ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive-soft px-3 py-2.5 text-sm text-foreground"
            >
              {state.message}
            </div>
          ) : null}

          <label className="flex items-start gap-2 rounded-md border bg-background p-3 text-sm">
            <input
              type="checkbox"
              name="confirmDelete"
              value="yes"
              required
              className="mt-0.5 size-4 accent-destructive"
            />
            I understand this private saved job will be permanently deleted.
          </label>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-md"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="h-9 rounded-md"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Deleting
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden />
                  Delete job
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PrivateJobControls({ job }: { job: PrivateJob }) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);

  return (
    <>
      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 justify-start rounded-md"
          onClick={() => setDialog("edit")}
        >
          <PencilLine className="size-4" aria-hidden />
          Edit job details
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-9 justify-start rounded-md"
          onClick={() => setDialog("delete")}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete private job
        </Button>
      </div>

      {dialog === "edit" ? (
        <EditPrivateJobModal job={job} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "delete" ? (
        <DeletePrivateJobDialog job={job} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
