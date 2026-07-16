"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { useActionState, useMemo } from "react";

import {
  createPrivateJobAction,
  updatePrivateJobAction,
} from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EMPTY_PRIVATE_JOB_FORM_VALUES,
  initialPrivateJobMutationState,
  privateJobToFormValues,
  type PrivateJobFormField,
  type PrivateJobMutationState,
} from "@/lib/jobs/forms";
import {
  PRIVATE_JOB_STATUSES,
  PRIVATE_JOB_WORK_AUTHORIZATIONS,
  PRIVATE_JOB_WORK_MODES,
  type PrivateJob,
} from "@/lib/jobs/types";

const inputClassName = "h-9 rounded-md bg-card text-sm";
const selectClassName =
  "h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClassName =
  "min-h-24 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const statusLabels = {
  saved: "Saved",
  tailoring: "Tailoring",
  ready: "Ready to apply",
  applied: "Applied",
  oa: "Online assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
} as const;

function FieldError({
  field,
  state,
}: {
  field: PrivateJobFormField;
  state: PrivateJobMutationState;
}) {
  const message = state.fieldErrors[field];
  if (!message) return null;
  return (
    <p id={`${field}-error`} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function describedBy(field: PrivateJobFormField, state: PrivateJobMutationState) {
  return state.fieldErrors[field] ? `${field}-error` : undefined;
}

type JobFormDialogProps = {
  mode: "create" | "edit";
  state: PrivateJobMutationState;
  formAction: (payload: FormData) => void;
  pending: boolean;
  onClose: () => void;
};

function JobFormDialog({
  mode,
  state,
  formAction,
  pending,
  onClose,
}: JobFormDialogProps) {
  const values = state.values;
  const title = mode === "create" ? "Add job" : "Edit job";

  if (state.status === "success") {
    return (
      <DialogFrame title={title} onClose={onClose}>
        <div className="px-5 py-6">
          <div className="flex items-start gap-3 rounded-md border border-success/25 bg-success-soft p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {mode === "create" ? "Job saved" : "Changes saved"}
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                {state.message}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {state.jobId ? (
                  <Button asChild className="h-9 rounded-md">
                    <Link href={`/jobs/${state.jobId}`}>View private job</Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-md"
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogFrame>
    );
  }

  return (
    <DialogFrame title={title} onClose={onClose}>
      <form action={formAction} className="space-y-5 px-5 py-5">
        {state.status === "error" ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive-soft px-3 py-2.5 text-sm text-foreground"
          >
            {state.message}
          </div>
        ) : null}

        <fieldset disabled={pending} className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-foreground">Source URL</span>
            <Input
              name="sourceUrl"
              type="url"
              maxLength={2048}
              defaultValue={values.sourceUrl}
              placeholder="https://company.ca/careers/co-op-role"
              aria-invalid={Boolean(state.fieldErrors.sourceUrl)}
              aria-describedby={describedBy("sourceUrl", state)}
              className={inputClassName}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Saved as a source link only. Automatic URL retrieval is not
              currently supported.
            </p>
            <FieldError field="sourceUrl" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Company</span>
            <Input
              name="companyName"
              required
              maxLength={160}
              defaultValue={values.companyName}
              aria-invalid={Boolean(state.fieldErrors.companyName)}
              aria-describedby={describedBy("companyName", state)}
              className={inputClassName}
            />
            <FieldError field="companyName" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Role</span>
            <Input
              name="title"
              required
              maxLength={200}
              defaultValue={values.title}
              aria-invalid={Boolean(state.fieldErrors.title)}
              aria-describedby={describedBy("title", state)}
              className={inputClassName}
            />
            <FieldError field="title" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Role type</span>
            <Input
              name="roleType"
              maxLength={80}
              defaultValue={values.roleType}
              placeholder="Software, embedded, data..."
              aria-invalid={Boolean(state.fieldErrors.roleType)}
              aria-describedby={describedBy("roleType", state)}
              className={inputClassName}
            />
            <FieldError field="roleType" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Location</span>
            <Input
              name="location"
              maxLength={160}
              defaultValue={values.location}
              placeholder="Vancouver, BC"
              aria-invalid={Boolean(state.fieldErrors.location)}
              aria-describedby={describedBy("location", state)}
              className={inputClassName}
            />
            <FieldError field="location" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Term</span>
            <Input
              name="term"
              maxLength={120}
              defaultValue={values.term}
              placeholder="Fall 2026 - 4 months"
              aria-invalid={Boolean(state.fieldErrors.term)}
              aria-describedby={describedBy("term", state)}
              className={inputClassName}
            />
            <FieldError field="term" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Work mode</span>
            <select
              name="workMode"
              defaultValue={values.workMode}
              aria-invalid={Boolean(state.fieldErrors.workMode)}
              aria-describedby={describedBy("workMode", state)}
              className={selectClassName}
            >
              <option value="">Not listed</option>
              {PRIVATE_JOB_WORK_MODES.map((modeOption) => (
                <option key={modeOption} value={modeOption}>
                  {modeOption}
                </option>
              ))}
            </select>
            <FieldError field="workMode" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Deadline</span>
            <Input
              name="deadline"
              type="date"
              defaultValue={values.deadline}
              aria-invalid={Boolean(state.fieldErrors.deadline)}
              aria-describedby={describedBy("deadline", state)}
              className={inputClassName}
            />
            <FieldError field="deadline" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Work authorization
            </span>
            <select
              name="workAuthorization"
              defaultValue={values.workAuthorization}
              aria-invalid={Boolean(state.fieldErrors.workAuthorization)}
              aria-describedby={describedBy("workAuthorization", state)}
              className={selectClassName}
            >
              <option value="">Not listed</option>
              {PRIVATE_JOB_WORK_AUTHORIZATIONS.map((authorization) => (
                <option key={authorization} value={authorization}>
                  {authorization}
                </option>
              ))}
            </select>
            <FieldError field="workAuthorization" state={state} />
          </label>

          {mode === "edit" ? (
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Status</span>
              <select
                name="status"
                defaultValue={values.status}
                className={selectClassName}
              >
                {PRIVATE_JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="status" value="saved" />
          )}

          <label className="flex items-center gap-2 self-end rounded-md border bg-background px-3 py-2.5 text-sm font-medium">
            <input
              type="checkbox"
              name="coopEligible"
              value="yes"
              defaultChecked={values.coopEligible}
              className="size-4 accent-brand"
            />
            Co-op eligible
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Notes</span>
            <textarea
              name="notes"
              maxLength={5000}
              rows={5}
              defaultValue={values.notes}
              aria-invalid={Boolean(state.fieldErrors.notes)}
              aria-describedby={describedBy("notes", state)}
              className={textareaClassName}
            />
            <FieldError field="notes" state={state} />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Paste job description
            </span>
            <textarea
              name="rawText"
              maxLength={100000}
              rows={5}
              defaultValue={values.rawText}
              placeholder="Stored only in your private saved job"
              aria-invalid={Boolean(state.fieldErrors.rawText)}
              aria-describedby={`rawText-help${state.fieldErrors.rawText ? " rawText-error" : ""}`}
              className={textareaClassName}
            />
            <p id="rawText-help" className="text-xs leading-5 text-muted-foreground">
              This full text stays private and is never published to the job board.
            </p>
            <FieldError field="rawText" state={state} />
          </label>
        </fieldset>

        <div className="flex items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-md"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-9 rounded-md" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving job
              </>
            ) : mode === "create" ? (
              "Save job"
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function DialogFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 px-4 py-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="private-job-dialog-title"
        className="w-full max-w-3xl rounded-xl border bg-card"
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 id="private-job-dialog-title" className="text-base font-semibold">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Save the posting details in your private COOPfinder workspace.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Close ${title.toLowerCase()}`}
            className="rounded-md text-muted-foreground"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AddPrivateJobModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(
    createPrivateJobAction,
    initialPrivateJobMutationState(EMPTY_PRIVATE_JOB_FORM_VALUES),
  );

  return (
    <JobFormDialog
      mode="create"
      state={state}
      formAction={formAction}
      pending={pending}
      onClose={onClose}
    />
  );
}

export function EditPrivateJobModal({
  job,
  onClose,
}: {
  job: PrivateJob;
  onClose: () => void;
}) {
  const action = useMemo(
    () => updatePrivateJobAction.bind(null, job.id),
    [job.id],
  );
  const initialState = useMemo(
    () => initialPrivateJobMutationState(privateJobToFormValues(job)),
    [job],
  );
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <JobFormDialog
      mode="edit"
      state={state}
      formAction={formAction}
      pending={pending}
      onClose={onClose}
    />
  );
}
