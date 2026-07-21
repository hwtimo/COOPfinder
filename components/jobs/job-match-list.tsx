import Link from "next/link";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplicationTrackingControl } from "@/components/jobs/application-tracking-control";
import { formatPrivateJobDate } from "@/lib/jobs/dates";
import {
  OWNED_JOB_MATCH_SORT_OPTIONS,
  sortOwnedJobMatchSummaries,
  type OwnedJobMatchSummary,
  type OwnedJobMatchesSort,
} from "@/lib/matching/job-match-summary";
import type { WorkAuthorizationMatch } from "@/lib/matching/resume-job-match";
import { cn } from "@/lib/utils";

const statusCopy: Record<
  OwnedJobMatchSummary["status"],
  { label: string; description: string }
> = {
  comparable: {
    label: "Comparable",
    description: "Exact, explicit evidence can be compared.",
  },
  insufficient_profile: {
    label: "Profile data needed",
    description: "Add explicit Master Profile evidence to compare this job.",
  },
  insufficient_job_data: {
    label: "No comparable requirements",
    description: "The saved analysis has no supported requirements to compare.",
  },
  invalid_extraction: {
    label: "Match unavailable",
    description: "This saved analysis could not be safely compared.",
  },
};

const workAuthorizationLabels: Record<
  WorkAuthorizationMatch["status"],
  string
> = {
  exact_match: "Exact match found",
  mismatch: "No exact match found",
  no_job_requirement: "No job requirement",
  no_candidate_value: "No profile value",
};

function CountValue({
  value,
}: {
  value: { evidenced: number; total: number } | null;
}) {
  return value ? (
    <span className="font-medium tabular-nums text-foreground">
      {value.evidenced} of {value.total}
    </span>
  ) : (
    <span className="text-muted-foreground">Unavailable</span>
  );
}

function CountNumber({ value }: { value: number | null }) {
  return value === null ? (
    <span className="text-muted-foreground">Unavailable</span>
  ) : (
    <span className="font-medium tabular-nums text-foreground">{value}</span>
  );
}

function MatchCard({ job }: { job: OwnedJobMatchSummary }) {
  const status = statusCopy[job.status];

  return (
    <article className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {status.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {formatPrivateJobDate(job.updatedAt)}
            </span>
          </div>
          <h2 className="mt-3 break-words text-base font-semibold text-foreground">
            {job.title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {job.companyName ?? "Company not listed"}
            {job.location ? ` · ${job.location}` : " · Location not listed"}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {status.description}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 self-start">
          <Link href={`/jobs/${job.jobId}`}>
            Explain match
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="mt-4 border-t pt-4">
        <ApplicationTrackingControl
          jobId={job.jobId}
          application={job.application}
        />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="text-xs text-muted-foreground">Required evidenced</dt>
          <dd className="mt-1 text-sm">
            <CountValue value={job.required} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Preferred evidenced</dt>
          <dd className="mt-1 text-sm">
            <CountValue value={job.preferred} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Work authorization</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {job.workAuthorizationStatus
              ? workAuthorizationLabels[job.workAuthorizationStatus]
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Not-evidenced required
          </dt>
          <dd className="mt-1 text-sm">
            <CountNumber value={job.notEvidencedRequiredCount} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Unassessed</dt>
          <dd className="mt-1 text-sm">
            <CountNumber value={job.unassessedRequirementCount} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Comparison method</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            Exact evidence
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function JobMatchList({
  jobs,
  sort,
}: {
  jobs: readonly OwnedJobMatchSummary[];
  sort: OwnedJobMatchesSort;
}) {
  const sortedJobs = sortOwnedJobMatchSummaries(jobs, sort);

  if (sortedJobs.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed bg-card px-4 py-12 text-center sm:px-6 sm:py-16">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <BriefcaseBusiness
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        </div>
        <h2 className="mt-4 text-sm font-semibold text-foreground">
          No analyzed jobs yet
        </h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          Analyze a private saved job to compare its structured requirements
          with explicit evidence in your Master Profile.
        </p>
        <Button asChild size="sm" className="mt-5 h-9">
          <Link href="/jobs">Open My jobs</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground">Sort jobs</p>
        <nav
          aria-label="Sort profile matches"
          className="mt-2 flex flex-wrap gap-2"
        >
          {OWNED_JOB_MATCH_SORT_OPTIONS.map((option) => {
            const active = option.value === sort;
            return (
              <Link
                key={option.value}
                href={`/jobs/matches?sort=${option.value}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-background text-text-secondary hover:bg-muted",
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Sorting organizes your saved records for review. It is not an
          eligibility or hiring recommendation.
        </p>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {sortedJobs.length} analyzed {sortedJobs.length === 1 ? "job" : "jobs"}
      </p>

      <div className="grid gap-4">
        {sortedJobs.map((job) => (
          <MatchCard key={job.jobId} job={job} />
        ))}
      </div>
    </div>
  );
}
