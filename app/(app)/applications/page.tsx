import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  Database,
  KanbanSquare,
  MapPin,
  Table2,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { getApplicationTrackerData } from "@/lib/applications/queries";
import {
  APPLICATION_TRACKER_COLUMNS,
  type ApplicationTrackerStatus,
  type EligibleApplicationJob,
  type TrackerApplication,
} from "@/lib/applications/types";
import {
  daysUntilPrivateJobDeadline,
  formatPrivateJobDeadline,
} from "@/lib/jobs/dates";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";
import { cn } from "@/lib/utils";

import { AddApplicationDialog } from "./add-application-dialog";

export const dynamic = "force-dynamic";

const columnAccent: Record<ApplicationTrackerStatus, string> = {
  saved: "bg-muted-foreground",
  tailoring: "bg-info",
  ready: "bg-brand",
  applied: "bg-text-secondary",
  interview: "bg-success",
  offer: "bg-success",
  rejected: "bg-destructive",
};

const emptyColumnCopy: Record<ApplicationTrackerStatus, string> = {
  saved: "Applications created from saved jobs will appear here.",
  tailoring: "Applications with resume work in progress will appear here.",
  ready: "Reviewed applications ready to submit will appear here.",
  applied: "Submitted applications will appear here.",
  interview: "Applications in the interview stage will appear here.",
  offer: "Applications with an offer will appear here.",
  rejected: "Closed applications can remain here for reference.",
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function formatOverdue(label: string, days: number) {
  const overdueBy = Math.abs(days);
  return overdueBy === 1
    ? `${label} overdue by 1d`
    : `${label} overdue by ${overdueBy}d`;
}

function applicationDeadline(application: TrackerApplication): string | null {
  return application.deadline ?? application.job?.deadline ?? null;
}

function getWarnings(application: TrackerApplication) {
  const warnings: string[] = [];
  const deadlineDays = daysUntilPrivateJobDeadline(
    dateOnly(applicationDeadline(application)),
  );
  const followUpDays = daysUntilPrivateJobDeadline(
    dateOnly(application.followUpDue),
  );

  if (deadlineDays !== null && deadlineDays < 0) {
    warnings.push(formatOverdue("Deadline", deadlineDays));
  }
  if (followUpDays !== null && followUpDays < 0) {
    warnings.push(formatOverdue("Follow-up", followUpDays));
  }

  return warnings;
}

function ApplicationCard({ application }: { application: TrackerApplication }) {
  const warnings = getWarnings(application);
  const deadline = applicationDeadline(application);
  const daysLeft = daysUntilPrivateJobDeadline(dateOnly(deadline));
  const companyName = application.job?.companyName ?? "Company not added";
  const role = application.job?.title ?? "Saved job unavailable";
  const place = [application.job?.location, application.job?.workMode]
    .filter(Boolean)
    .join(" · ");
  const lastAction = application.lastAction ?? "No activity recorded";
  const nextAction = application.nextAction ?? "No next action set";

  return (
    <Link
      href={`/applications/${application.id}`}
      aria-label={`Open application detail for ${companyName} ${role}. Last action: ${lastAction}. Next action: ${nextAction}.`}
      title={`${lastAction} · ${nextAction}`}
      className="group block rounded-md border bg-background p-3 transition-colors hover:border-border-strong hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <article>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground group-hover:underline">
              {companyName}
            </p>
            <p className="mt-0.5 truncate text-xs leading-5 text-text-secondary">
              {role}
            </p>
          </div>
          <ArrowRight
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand"
            aria-hidden
          />
        </div>

        <div className="mt-2">
          <StatusBadge status={application.status} />
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{place || "Location not added"}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {daysLeft === null ? (
            <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              No deadline
            </span>
          ) : (
            <DeadlineBadge
              daysLeft={daysLeft}
              label={formatPrivateJobDeadline(dateOnly(deadline))}
            />
          )}
        </div>

        {warnings.length > 0 ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-destructive/20 bg-destructive-soft px-2 py-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{warnings[0]}</span>
          </div>
        ) : null}

        <div className="mt-2 rounded-md bg-muted/40 px-2.5 py-2 text-xs">
          <p className="truncate font-semibold text-brand">
            <span className="font-medium text-muted-foreground">Next:</span>{" "}
            {nextAction}
          </p>
        </div>
      </article>
    </Link>
  );
}

function HeaderActions({
  eligibleJobs,
  savedJobCount,
  disabledReason,
}: {
  eligibleJobs: EligibleApplicationJob[];
  savedJobCount: number;
  disabledReason?: string;
}) {
  return (
    <>
      <div
        className="flex items-center gap-1 rounded-md border bg-card p-1"
        aria-label="Application view options"
      >
        <Button type="button" variant="secondary" size="sm" className="h-7 rounded-md px-2.5">
          <KanbanSquare className="size-3.5" aria-hidden />
          Board
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-md px-2.5 text-muted-foreground"
          disabled
          title="Table view is not available yet"
        >
          <Table2 className="size-3.5" aria-hidden />
          Table
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-md px-2.5 text-muted-foreground"
          disabled
          title="Calendar view is not available yet"
        >
          <CalendarRange className="size-3.5" aria-hidden />
          Calendar
        </Button>
      </div>
      <AddApplicationDialog
        eligibleJobs={eligibleJobs}
        savedJobCount={savedJobCount}
        disabledReason={disabledReason}
      />
    </>
  );
}

function PageState({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "info" | "warning";
}) {
  const Icon = tone === "info" ? Database : AlertTriangle;
  return (
    <div className="rounded-lg border border-dashed bg-card px-4 py-12 text-center sm:px-6 sm:py-16">
      <div
        className={cn(
          "mx-auto flex size-10 items-center justify-center rounded-lg",
          tone === "info" ? "bg-info-soft" : "bg-warning-soft",
        )}
      >
        <Icon
          className={cn("size-5", tone === "info" ? "text-info" : "text-warning")}
          aria-hidden
        />
      </div>
      <h2 className="mt-4 text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default async function ApplicationsPage() {
  const configured = Boolean(getSupabaseEnv());
  let applications: TrackerApplication[] = [];
  let eligibleJobs: EligibleApplicationJob[] = [];
  let savedJobCount = 0;
  let loadError = false;

  if (configured) {
    const user = await getSupabaseUser();
    if (!user) redirect("/login?next=%2Fapplications");

    const result = await getApplicationTrackerData(user.id);
    applications = result.data.applications;
    eligibleJobs = result.data.eligibleJobs;
    savedJobCount = result.data.savedJobCount;
    loadError = result.status === "error";
  }

  const disabledReason = !configured
    ? "Supabase is not configured"
    : loadError
      ? "Applications could not load"
      : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Applications"
        description="Track each co-op application from saved to final outcome."
        actions={
          <HeaderActions
            eligibleJobs={eligibleJobs}
            savedJobCount={savedJobCount}
            disabledReason={disabledReason}
          />
        }
      />

      {!configured ? (
        <PageState
          tone="info"
          title="Applications are unavailable"
          description="Supabase is not configured for this build. No mock applications are shown, and application actions are disabled."
        />
      ) : loadError ? (
        <PageState
          tone="warning"
          title="Applications could not load"
          description="The private applications connection is unavailable. No mock or cross-user data was shown."
        />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No applications yet"
          description="Applications are created from your private saved jobs. Save a job, then use Add application to start tracking it."
          actionLabel="View saved jobs"
          onActionHref="/jobs"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Application board</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Persisted applications grouped by their current status.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden />
              <span>{pluralize(applications.length, "tracked application")}</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1260px] grid-cols-7 gap-3">
              {APPLICATION_TRACKER_COLUMNS.map((column) => {
                const columnApplications = applications.filter(
                  (application) => application.status === column.id,
                );

                return (
                  <section
                    key={column.id}
                    className="flex min-h-[560px] flex-col rounded-lg border bg-card"
                    aria-labelledby={`application-column-${column.id}`}
                  >
                    <header className="border-b px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              columnAccent[column.id],
                            )}
                            aria-hidden
                          />
                          <h2
                            id={`application-column-${column.id}`}
                            className="truncate text-sm font-semibold text-foreground"
                          >
                            {column.label}
                          </h2>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary tabular-nums">
                          {columnApplications.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{column.helper}</p>
                    </header>

                    <div className="flex flex-1 flex-col gap-3 p-3">
                      {columnApplications.length > 0 ? (
                        columnApplications.map((application) => (
                          <ApplicationCard key={application.id} application={application} />
                        ))
                      ) : (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center">
                          <div className="flex size-9 items-center justify-center rounded-md bg-card">
                            <KanbanSquare className="size-4 text-muted-foreground" aria-hidden />
                          </div>
                          <p className="mt-3 text-sm font-medium text-foreground">
                            No {column.label.toLowerCase()} applications
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {emptyColumnCopy[column.id]}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
