import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Inbox,
  LockKeyhole,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { BoardSubmissionForm } from "@/components/board/board-submission-form";
import { getLoginHref } from "@/lib/auth/paths";
import {
  BOARD_SUBMISSION_STATUS_LABELS,
  getOwnBoardSubmissions,
  type BoardSubmissionStatus,
} from "@/lib/board/submissions";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusTone: Record<BoardSubmissionStatus, string> = {
  pending_review: "bg-info-soft text-info",
  approved: "bg-success-soft text-success",
  rejected: "bg-muted text-text-secondary",
  archived: "bg-muted text-text-secondary",
};

function formatSubmittedAt(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function BoardSubmitPage() {
  const configured = Boolean(getSupabaseEnv());
  const user = configured ? await getSupabaseUser() : null;
  const submissions = user ? await getOwnBoardSubmissions(user.id) : null;

  return (
    <div className="space-y-5">
      <Link
        href="/board"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to job board
      </Link>

      <PageHeader
        title="Submit a role"
        description="Suggest a Canadian co-op or internship for review while keeping the original description in your private workspace."
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <BoardSubmissionForm configured={configured} />

        <aside className="space-y-4 xl:sticky xl:top-20">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-sm font-semibold">What happens next</h2>
            <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
              <p>
                The role stays inactive and does not appear publicly until a
                person reviews it.
              </p>
              <p>
                Approved board entries use a short COOPfinder summary, never
                your pasted full description.
              </p>
              <p>
                COOPfinder does not apply for you. You use the original source
                to verify details and submit your application.
              </p>
            </div>
          </section>

          {user && submissions ? (
            <section
              className="rounded-lg border bg-card p-5"
              aria-labelledby="submissions-title"
            >
              <div>
                <h2 id="submissions-title" className="text-sm font-semibold">
                  Your board submissions
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Moderation never blocks your private saved copy.
                </p>
              </div>

              {submissions.status === "error" ? (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2.5 text-xs leading-5 text-foreground">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-warning"
                    aria-hidden
                  />
                  Submission statuses could not load. Your private records were
                  not exposed.
                </div>
              ) : submissions.data.length === 0 ? (
                <div className="mt-4 rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center">
                  <Inbox
                    className="mx-auto size-5 text-muted-foreground"
                    aria-hidden
                  />
                  <p className="mt-2 text-sm font-medium">No submissions yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Roles you submit will appear here with their review status.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 divide-y">
                  {submissions.data.map((submission) => (
                    <li
                      key={submission.id}
                      className="py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {submission.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {submission.companyName}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            statusTone[submission.status],
                          )}
                        >
                          {BOARD_SUBMISSION_STATUS_LABELS[submission.status]}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{formatSubmittedAt(submission.submittedAt)}</span>
                        <a
                          href={submission.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-brand hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Original source
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <section className="rounded-lg border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info-soft text-info">
                  <LockKeyhole className="size-4" aria-hidden />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">
                    {configured ? "Sign in required" : "Submission unavailable"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {configured
                      ? "You can review the form now. Sign in is required before COOPfinder saves a private copy or submits the role for review."
                      : "Supabase is not configured for this build, so no role can be submitted."}
                  </p>
                  {configured ? (
                    <Link
                      href={getLoginHref(
                        "/board/submit",
                        "submit_board_job",
                      )}
                      className="mt-3 inline-flex text-xs font-medium text-brand hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Log in to submit
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
