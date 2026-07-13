"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useActionState } from "react";

import { submitBoardJobAction } from "@/app/(app)/board/submit/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INITIAL_BOARD_SUBMISSION_STATE } from "@/lib/board/submission-form";

const inputClassName =
  "mt-1.5 h-10 rounded-md bg-background px-3 text-sm disabled:bg-muted/50";
const textareaClassName =
  "mt-1.5 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50";
const selectClassName =
  "mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-50";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function BoardSubmissionForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(
    submitBoardJobAction,
    INITIAL_BOARD_SUBMISSION_STATE,
  );
  const disabled = pending || !configured;

  if (state.status === "success") {
    return (
      <section className="rounded-lg border border-success/25 bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
            <CheckCircle2 className="size-4" aria-hidden />
          </div>
          <div>
            <span className="inline-flex rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info">
              Pending review
            </span>
            <h2 className="mt-3 text-base font-semibold">Submission received</h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {state.message} The pasted job description is in your private
              saved copy and is not published on the board.
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              A reviewer will write an in-house summary before any approved
              role becomes public. No review timeline is implied.
            </p>
            <Button asChild className="mt-4 h-9 rounded-md">
              <Link href="/board">Back to job board</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form action={formAction} className="rounded-lg border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3 border-b pb-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
          <ShieldCheck className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold">Role details</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            A person reviews every suggestion before it appears publicly.
          </p>
        </div>
      </div>

      {!configured ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-info/20 bg-info-soft px-3 py-2.5 text-sm text-foreground">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
          <p>
            Supabase is not configured for this build. Submission is disabled,
            and no role will be saved or fabricated.
          </p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div
          className="mt-4 rounded-md border border-destructive/20 bg-destructive-soft px-3 py-2.5 text-sm text-foreground"
          role="alert"
        >
          {state.message}
        </div>
      ) : null}

      <fieldset disabled={disabled} className="mt-5 space-y-5">
        <label className="block text-sm font-medium text-foreground">
          Original posting URL
          <Input
            name="sourceUrl"
            type="url"
            required
            maxLength={2048}
            defaultValue={state.values.sourceUrl}
            placeholder="https://company.example/careers/role"
            aria-invalid={Boolean(state.fieldErrors.sourceUrl)}
            aria-describedby={state.fieldErrors.sourceUrl ? "sourceUrl-error" : undefined}
            className={inputClassName}
          />
          <FieldError id="sourceUrl-error" message={state.fieldErrors.sourceUrl} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Job title
            <Input
              name="title"
              required
              maxLength={200}
              defaultValue={state.values.title}
              placeholder="Software Engineering Co-op"
              aria-invalid={Boolean(state.fieldErrors.title)}
              aria-describedby={state.fieldErrors.title ? "title-error" : undefined}
              className={inputClassName}
            />
            <FieldError id="title-error" message={state.fieldErrors.title} />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Company
            <Input
              name="companyName"
              required
              maxLength={160}
              defaultValue={state.values.companyName}
              placeholder="Company name"
              aria-invalid={Boolean(state.fieldErrors.companyName)}
              aria-describedby={state.fieldErrors.companyName ? "companyName-error" : undefined}
              className={inputClassName}
            />
            <FieldError id="companyName-error" message={state.fieldErrors.companyName} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Location
            <Input
              name="location"
              maxLength={160}
              defaultValue={state.values.location}
              placeholder="Vancouver, BC"
              aria-invalid={Boolean(state.fieldErrors.location)}
              aria-describedby={state.fieldErrors.location ? "location-error" : undefined}
              className={inputClassName}
            />
            <FieldError id="location-error" message={state.fieldErrors.location} />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Work mode
            <select
              name="workMode"
              defaultValue={state.values.workMode}
              aria-invalid={Boolean(state.fieldErrors.workMode)}
              aria-describedby={state.fieldErrors.workMode ? "workMode-error" : undefined}
              className={selectClassName}
            >
              <option value="">Not listed</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
            <FieldError id="workMode-error" message={state.fieldErrors.workMode} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Term
            <Input
              name="term"
              maxLength={120}
              defaultValue={state.values.term}
              placeholder="Fall 2026 - 4 months"
              aria-invalid={Boolean(state.fieldErrors.term)}
              aria-describedby={state.fieldErrors.term ? "term-error" : undefined}
              className={inputClassName}
            />
            <FieldError id="term-error" message={state.fieldErrors.term} />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Deadline
            <Input
              name="deadline"
              type="date"
              defaultValue={state.values.deadline}
              aria-invalid={Boolean(state.fieldErrors.deadline)}
              aria-describedby={state.fieldErrors.deadline ? "deadline-error" : undefined}
              className={inputClassName}
            />
            <FieldError id="deadline-error" message={state.fieldErrors.deadline} />
          </label>
        </div>

        <label className="block text-sm font-medium text-foreground">
          Skills or tags
          <Input
            name="keywords"
            defaultValue={state.values.keywords}
            placeholder="TypeScript, React, APIs"
            aria-invalid={Boolean(state.fieldErrors.keywords)}
            aria-describedby="keywords-help keywords-error"
            className={inputClassName}
          />
          <p id="keywords-help" className="mt-1 text-xs text-muted-foreground">
            Optional. Add up to 20 comma-separated, public-safe terms.
          </p>
          <FieldError id="keywords-error" message={state.fieldErrors.keywords} />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Submission note
          <textarea
            name="submissionNote"
            maxLength={2000}
            defaultValue={state.values.submissionNote}
            placeholder="Optional context for the reviewer"
            aria-invalid={Boolean(state.fieldErrors.submissionNote)}
            aria-describedby={state.fieldErrors.submissionNote ? "submissionNote-error" : undefined}
            className={textareaClassName}
          />
          <FieldError id="submissionNote-error" message={state.fieldErrors.submissionNote} />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Paste job description
          <textarea
            name="rawText"
            maxLength={100000}
            defaultValue={state.values.rawText}
            placeholder="Optional. Paste the full posting for your private saved copy."
            aria-invalid={Boolean(state.fieldErrors.rawText)}
            aria-describedby="rawText-help rawText-error"
            className={`${textareaClassName} min-h-40`}
          />
          <p id="rawText-help" className="mt-1 text-xs leading-5 text-muted-foreground">
            Stored only in your private job record. It is never copied to the
            public board candidate.
          </p>
          <FieldError id="rawText-error" message={state.fieldErrors.rawText} />
        </label>
      </fieldset>

      <div className="mt-5 border-t pt-4">
        <p className="text-xs leading-5 text-muted-foreground">
          COOPfinder may publish an in-house summary after review. You still
          verify the details and apply yourself on the original site.
        </p>
        <Button
          type="submit"
          size="lg"
          className="mt-3 h-10 rounded-md"
          disabled={disabled}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Submitting for review
            </>
          ) : (
            "Submit for review"
          )}
        </Button>
      </div>
    </form>
  );
}
