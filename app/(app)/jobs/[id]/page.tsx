import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileQuestion,
  FileText,
  LockKeyhole,
} from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import { PrivateJobControls } from "@/components/jobs/private-job-controls";
import { JobAnalysisControl } from "@/components/jobs/job-analysis-control";
import { Button } from "@/components/ui/button";
import {
  buildJobExtractionViewModel,
  type JobExtractionAnalysisViewModel,
} from "@/lib/ai/job-extraction-view-model";
import {
  daysUntilPrivateJobDeadline,
  formatPrivateJobDate,
  formatPrivateJobDeadline,
} from "@/lib/jobs/dates";
import { isValidHttpUrl } from "@/lib/jobs/forms";
import { getPrivateJob } from "@/lib/jobs/queries";
import type { PrivateJobIntakeSource } from "@/lib/jobs/types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

type JobDetailPageProps = {
  params: Promise<{ id: string }>;
};

const intakeLabels: Record<PrivateJobIntakeSource, string> = {
  manual: "Manual entry",
  pasted_url: "Pasted URL",
  pasted_text: "Pasted description",
  board_save: "Saved from job board",
};

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function MutedPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
      {children}
    </span>
  );
}

const reviewClassificationLabels: Record<
  Extract<JobExtractionAnalysisViewModel, { status: "ready" }>["reviewClassification"],
  string
> = {
  normal_review: "Standard review",
  low_confidence_review: "Low-confidence review",
  manual_review: "Manual review",
};

function AnalysisList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Not provided</p>
      )}
    </section>
  );
}

function JobAnalysis({ analysis }: { analysis: JobExtractionAnalysisViewModel }) {
  if (analysis.status === "not_generated") {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-10 text-center">
        <FileQuestion className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h3 className="mt-3 text-sm font-semibold">Analysis not generated yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          This phase stores private job data only. No AI summary, skills,
          missing keywords, match score, or resume suggestions were fabricated.
        </p>
      </div>
    );
  }

  if (analysis.status === "unavailable") {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center">
        <AlertTriangle className="mx-auto size-5 text-muted-foreground" aria-hidden />
        <h3 className="mt-3 text-sm font-semibold">Saved analysis is unavailable</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          The saved analysis could not be safely validated, so none of its
          fields are shown.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DetailItem label="Company">{analysis.company ?? "Not provided"}</DetailItem>
        <DetailItem label="Title">{analysis.title ?? "Not provided"}</DetailItem>
        <DetailItem label="Location">{analysis.location ?? "Not provided"}</DetailItem>
        <DetailItem label="Work mode">{analysis.workMode ?? "Not provided"}</DetailItem>
        <DetailItem label="Term">{analysis.term ?? "Not provided"}</DetailItem>
        <DetailItem label="Deadline">{analysis.deadline ?? "Not provided"}</DetailItem>
      </dl>

      <div className="grid gap-6 border-t pt-5 lg:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold text-foreground">Named skills</h3>
          {analysis.namedSkills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {analysis.namedSkills.map((skill) => (
                <MutedPill key={skill}>{skill}</MutedPill>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not provided</p>
          )}
        </section>
        <dl className="grid grid-cols-2 gap-3">
          <DetailItem label="Overall confidence">
            {Math.round(analysis.overallConfidence * 100)}%
          </DetailItem>
          <DetailItem label="Review classification">
            {reviewClassificationLabels[analysis.reviewClassification]}
          </DetailItem>
        </dl>
      </div>

      <div className="grid gap-6 border-t pt-5 lg:grid-cols-2">
        <AnalysisList title="Responsibilities" items={analysis.responsibilities} />
        <AnalysisList title="Explicit requirements" items={analysis.requirements} />
      </div>
    </div>
  );
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params;
  const configured = Boolean(getSupabaseEnv());

  if (!configured) {
    return (
      <div className="space-y-5">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to jobs
        </Link>
        <EmptyState
          icon={LockKeyhole}
          title="Private job unavailable"
          description="Supabase is not configured for this build. No mock private job or persisted details were shown."
        />
      </div>
    );
  }

  const user = await getSupabaseUser();
  if (!user) redirect("/board");

  const result = await getPrivateJob(user.id, id);

  if (result.status === "error") {
    return (
      <div className="space-y-5">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to jobs
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="This private job could not load"
          description="The private jobs connection is unavailable. No mock or cross-user record was shown."
          actionLabel="Return to jobs"
          onActionHref="/jobs"
        />
      </div>
    );
  }

  const job = result.data;
  if (!job) notFound();

  const deadlineDays = daysUntilPrivateJobDeadline(job.deadline);
  const validSourceUrl = job.sourceUrl && isValidHttpUrl(job.sourceUrl);
  const analysis = buildJobExtractionViewModel(
    job.extracted,
    job.extractionConfidence,
  );
  const canAnalyze =
    job.intakeSource === "pasted_text" &&
    Boolean(job.rawText?.trim()) &&
    analysis.status !== "unavailable";

  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to jobs
      </Link>

      <PageHeader
        title={job.title}
        description={`${job.companyName ?? "Company not listed"}${job.location ? ` · ${job.location}` : ""}`}
        actions={<StatusBadge status={job.status} />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand">
                  <LockKeyhole className="size-3" aria-hidden />
                  Private saved job
                </span>
                <h2 className="mt-4 text-lg font-semibold">
                  {job.companyName ?? "Company not listed"}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Saved {formatPrivateJobDate(job.createdAt)} · Updated {formatPrivateJobDate(job.updatedAt)}
                </p>
              </div>
              {deadlineDays === null ? (
                <MutedPill>No deadline listed</MutedPill>
              ) : (
                <DeadlineBadge
                  daysLeft={deadlineDays}
                  label={formatPrivateJobDeadline(job.deadline)}
                />
              )}
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Location">{job.location ?? "Not listed"}</DetailItem>
              <DetailItem label="Term">{job.term ?? "Not listed"}</DetailItem>
              <DetailItem label="Work mode">{job.workMode ?? "Not listed"}</DetailItem>
              <DetailItem label="Deadline">{formatPrivateJobDate(job.deadline)}</DetailItem>
            </dl>
          </section>

          <CardSection
            title="Private job description"
            description="Visible only in your saved job record"
            action={
              <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
                Never published to the board
              </span>
            }
          >
            {job.rawText ? (
              <div className="whitespace-pre-wrap text-sm leading-7 text-text-secondary">
                {job.rawText}
              </div>
            ) : (
              <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center">
                <FileText className="mx-auto size-5 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium">No description pasted</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Edit this job to add the original posting text to your private record.
                </p>
              </div>
            )}
          </CardSection>

          <CardSection
            title="Job analysis"
            description="Validated fields from the saved job description"
          >
            <div className="space-y-4">
              <JobAnalysis analysis={analysis} />
              {canAnalyze ? (
                <JobAnalysisControl
                  jobId={job.id}
                  hasSavedAnalysis={analysis.status === "ready"}
                />
              ) : null}
            </div>
          </CardSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <CardSection title="Decision panel" description="Saved-job readiness">
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Estimated match
                </p>
                <p className="mt-2 text-2xl font-medium text-text-secondary tabular-nums">
                  {job.matchScore === null ? "Not analyzed" : `${job.matchScore}%`}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {job.matchScore === null
                    ? "No analysis has been generated for this record."
                    : "This is a previously stored estimate; no new analysis was run."}
                </p>
              </div>

              <dl className="space-y-3">
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">Missing keywords</dt>
                  <dd className="mt-1 text-sm font-medium">Not generated</dd>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">
                    Suggested resume version
                  </dt>
                  <dd className="mt-1 text-sm font-medium">Not available</dd>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <dt className="text-xs text-muted-foreground">Application status</dt>
                  <dd className="mt-2">
                    <StatusBadge status={job.status} />
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                className="h-9 w-full rounded-md"
                disabled
                title="Resume tailoring is not available for persisted jobs yet"
              >
                <FileText className="size-4" aria-hidden />
                Tailor resume unavailable
              </Button>
            </div>
          </CardSection>

          <CardSection title="Manage private job">
            <PrivateJobControls job={job} />
          </CardSection>

          <CardSection title="Posting details" contentClassName="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Source</p>
              {validSourceUrl ? (
                <a
                  href={job.sourceUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  View original posting
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : (
                <p className="mt-1 text-sm text-text-secondary">Not provided</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Work authorization</p>
              <p className="mt-1 text-sm text-text-secondary">
                {job.workAuthorization ?? "Not listed"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saved note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-text-secondary">
                {job.notes ?? "No note saved"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Intake source</p>
              <p className="mt-1 text-sm text-text-secondary">
                {intakeLabels[job.intakeSource]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <MutedPill>{job.roleType ?? "Not classified"}</MutedPill>
              <MutedPill>{job.workMode ?? "Work mode not listed"}</MutedPill>
              <MutedPill>
                {job.coopEligible ? "Co-op eligible" : "Check co-op"}
              </MutedPill>
            </div>
          </CardSection>
        </aside>
      </div>
    </div>
  );
}
