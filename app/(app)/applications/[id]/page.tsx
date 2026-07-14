import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarClock,
  Clock3,
  ExternalLink,
  History,
  LockKeyhole,
} from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { getApplicationDetail } from "@/lib/applications/queries";
import { isIsoCalendarDate } from "@/lib/applications/update-deadline";
import { isIsoTimestampWithTimezone } from "@/lib/applications/update-follow-up";
import {
  APPLICATION_TRACKER_COLUMNS,
  type ApplicationTimelineEvent,
} from "@/lib/applications/types";
import { daysUntilPrivateJobDeadline } from "@/lib/jobs/dates";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

import { ApplicationDeadlineForm } from "./application-deadline-form";
import { ApplicationDeleteControl } from "./application-delete-control";
import { ApplicationFollowUpForm } from "./application-follow-up-form";
import { ApplicationNotesForm } from "./application-notes-form";
import { ApplicationStatusForm } from "./application-status-form";

export const dynamic = "force-dynamic";

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

const eventLabels: Record<string, string> = {
  application_created: "Application created",
  status_changed: "Status changed",
  note_updated: "Notes updated",
  deadline_changed: "Deadline updated",
  follow_up_changed: "Follow-up updated",
  marked_applied: "Marked as applied",
  activity: "Application activity",
};

const statusLabels = new Map<string, string>(
  APPLICATION_TRACKER_COLUMNS.map((status) => [status.id, status.label]),
);

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

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function formatDate(value: string | null, fallback: string): string {
  if (!value) return fallback;

  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatEventTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Time unavailable";

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatDateTime(value: string | null, fallback: string): string {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(parsed);
}

function metadataStatus(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && statusLabels.has(value)) return value;
  }
  return null;
}

function metadataDeadline(
  metadata: Record<string, unknown>,
  key: "previous_deadline" | "new_deadline",
): string | null | undefined {
  if (!Object.hasOwn(metadata, key)) return undefined;

  const value = metadata[key];
  if (value === null) return null;
  return isIsoCalendarDate(value) ? value : undefined;
}

function metadataFollowUp(
  metadata: Record<string, unknown>,
  key: "previous_follow_up_due" | "new_follow_up_due",
): string | null | undefined {
  if (!Object.hasOwn(metadata, key)) return undefined;

  const value = metadata[key];
  if (value === null) return null;
  return isIsoTimestampWithTimezone(value) ? value : undefined;
}

function eventDetail(event: ApplicationTimelineEvent): string {
  switch (event.eventType) {
    case "application_created":
      return event.metadata.source === "private_saved_job"
        ? "Created from a private saved job."
        : "Application tracking started.";
    case "status_changed": {
      const previous = metadataStatus(event.metadata, [
        "previous_status",
        "from_status",
        "old_status",
      ]);
      const next = metadataStatus(event.metadata, [
        "status",
        "new_status",
        "to_status",
      ]);

      if (previous && next) {
        return `Changed from ${statusLabels.get(previous)} to ${statusLabels.get(next)}.`;
      }
      if (next) return `Changed to ${statusLabels.get(next)}.`;
      return "The application status was updated.";
    }
    case "note_updated":
      return "Application notes were updated.";
    case "deadline_changed": {
      const previous = metadataDeadline(event.metadata, "previous_deadline");
      const next = metadataDeadline(event.metadata, "new_deadline");

      if (previous === undefined || next === undefined) {
        return "The application deadline was updated.";
      }
      if (previous === null && next !== null) {
        return `Deadline set to ${formatDate(next, "a saved date")}.`;
      }
      if (previous !== null && next === null) {
        return `Deadline cleared; previously ${formatDate(previous, "a saved date")}.`;
      }
      if (previous !== null && next !== null) {
        return `Deadline changed from ${formatDate(previous, "a saved date")} to ${formatDate(next, "a saved date")}.`;
      }
      return "The application deadline was updated.";
    }
    case "follow_up_changed": {
      const previous = metadataFollowUp(
        event.metadata,
        "previous_follow_up_due",
      );
      const next = metadataFollowUp(event.metadata, "new_follow_up_due");

      if (previous === undefined || next === undefined) {
        return "The follow-up schedule was updated.";
      }
      if (previous === null && next !== null) {
        return `Follow-up set for ${formatDateTime(next, "a saved time")}.`;
      }
      if (previous !== null && next === null) {
        return `Follow-up cleared; previously ${formatDateTime(previous, "a saved time")}.`;
      }
      if (previous !== null && next !== null) {
        return `Follow-up changed from ${formatDateTime(previous, "a saved time")} to ${formatDateTime(next, "a saved time")}.`;
      }
      return "The follow-up schedule was updated.";
    }
    case "marked_applied":
      return "The application was marked as applied.";
    default:
      return "Application activity was recorded.";
  }
}

function isSafeSourceUrl(value: string | null): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const { id } = await params;
  const configured = Boolean(getSupabaseEnv());

  if (!configured) {
    return (
      <div className="space-y-5">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to applications
        </Link>
        <EmptyState
          icon={LockKeyhole}
          title="Application unavailable"
          description="Supabase is not configured for this build. No mock application or timeline data was shown."
        />
      </div>
    );
  }

  const user = await getSupabaseUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/applications/${id}`)}`);
  }

  const result = await getApplicationDetail(user.id, id);

  if (result.status === "error") {
    return (
      <div className="space-y-5">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to applications
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="This application could not load"
          description="The private applications connection is unavailable. No mock or cross-user record was shown."
          actionLabel="Return to applications"
          onActionHref="/applications"
        />
      </div>
    );
  }

  const application = result.data;
  if (!application) notFound();

  const { job } = application;
  const companyName = job.companyName ?? "Company not added";
  const location = job.location ?? "Location not added";
  const workMode = job.workMode ?? "Work mode not added";
  const term = job.term ?? "Term not added";
  const deadlineDate = dateOnly(application.deadline);
  const deadlineDays = daysUntilPrivateJobDeadline(deadlineDate);
  const sourceUrl = isSafeSourceUrl(job.sourceUrl) ? job.sourceUrl : null;

  return (
    <div className="space-y-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-text-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to tracker
      </Link>

      <PageHeader
        title={`${companyName} application`}
        description={`${job.title} - ${location}`}
        actions={<StatusBadge status={application.status} />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                  Private application
                </span>
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  {job.title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Created {formatDate(application.createdAt, "Date unavailable")} - Updated{" "}
                  {formatDate(application.updatedAt, "Date unavailable")}
                </p>
              </div>
              {deadlineDays === null ? (
                <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                  No deadline
                </span>
              ) : (
                <DeadlineBadge
                  daysLeft={deadlineDays}
                  label={formatDate(deadlineDate, "No deadline")}
                />
              )}
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Company">{companyName}</DetailItem>
              <DetailItem label="Location">{location}</DetailItem>
              <DetailItem label="Term">{term}</DetailItem>
              <DetailItem label="Work mode">{workMode}</DetailItem>
            </dl>
          </section>

          <CardSection
            title="Application details"
            description="Persisted dates and status for this application"
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Status">
                {statusLabels.get(application.status) ?? "Status unavailable"}
              </DetailItem>
              <DetailItem label="Deadline">
                {formatDate(deadlineDate, "No deadline")}
              </DetailItem>
              <DetailItem label="Follow-up">
                {formatDateTime(
                  application.followUpDue,
                  "No follow-up scheduled",
                )}
              </DetailItem>
              <DetailItem label="Applied">
                {formatDate(application.appliedAt, "Not marked as applied")}
              </DetailItem>
            </dl>
          </CardSection>

          <CardSection
            title="Timeline"
            description="Persisted activity for this application"
          >
            {application.timeline.length > 0 ? (
              <ol className="space-y-4">
                {application.timeline.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                      <span className="size-2 rounded-full bg-brand" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 rounded-md border bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {eventLabels[event.eventType] ?? "Application activity"}
                        </p>
                        <time
                          dateTime={event.eventAt}
                          className="text-xs text-muted-foreground"
                        >
                          {formatEventTime(event.eventAt)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        {eventDetail(event)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center">
                <History className="mx-auto size-5 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-sm font-medium text-foreground">
                  No timeline activity yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Persisted application events will appear here.
                </p>
              </div>
            )}
          </CardSection>

          <CardSection title="Notes" description="Saved application notes">
            <ApplicationNotesForm
              applicationId={application.id}
              initialNotes={application.notes}
            />
          </CardSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <CardSection title="Application actions" description="Review the linked records">
            <div className="space-y-3">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">Application status</p>
                <div className="mt-2">
                  <StatusBadge status={application.status} />
                </div>
              </div>
              <ApplicationStatusForm
                applicationId={application.id}
                currentStatus={application.status}
              />
              <ApplicationDeadlineForm
                applicationId={application.id}
                initialDeadline={dateOnly(application.deadline)}
              />
              <ApplicationFollowUpForm
                applicationId={application.id}
                initialFollowUpDue={application.followUpDue}
              />
              <Button asChild className="h-9 w-full rounded-md">
                <Link href={`/jobs/${application.jobPostingId}`}>
                  <Briefcase className="size-4" aria-hidden />
                  View job detail
                </Link>
              </Button>
              {sourceUrl ? (
                <Button asChild variant="outline" className="h-9 w-full rounded-md">
                  <a href={sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    View source posting
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="ghost" className="h-9 w-full rounded-md">
                <Link href="/applications">
                  <ArrowLeft className="size-4" aria-hidden />
                  Return to tracker
                </Link>
              </Button>
            </div>
          </CardSection>

          <CardSection title="Record details" contentClassName="space-y-3">
            <div className="flex items-start gap-2">
              <CalendarClock
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="text-xs text-muted-foreground">Follow-up</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatDateTime(
                    application.followUpDue,
                    "No follow-up scheduled",
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock3
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="text-xs text-muted-foreground">Last updated</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {formatDate(application.updatedAt, "Date unavailable")}
                </p>
              </div>
            </div>
          </CardSection>

          <CardSection
            title="Delete application"
            description="Remove this tracking record and its timeline"
          >
            <ApplicationDeleteControl applicationId={application.id} />
          </CardSection>
        </aside>
      </div>
    </div>
  );
}
