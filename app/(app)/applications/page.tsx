import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  FileText,
  KanbanSquare,
  MapPin,
  Plus,
  Table2,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applicationColumns,
  daysUntil,
  formatDeadline,
  mockApplications,
  mockJobs,
  type ApplicationTrackerStatus,
  type MockApplication,
  type MockJob,
} from "@/lib/mock";

interface ApplicationCardData {
  application: MockApplication;
  job: MockJob;
}

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
  saved: "Newly saved postings will land here before resume work starts.",
  tailoring: "Resume drafts in progress will appear here.",
  ready: "Reviewed applications that are ready to send will appear here.",
  applied: "Submitted applications will move here while you wait.",
  interview: "Interviewing roles and follow-ups will appear here.",
  offer: "Offers will appear here for comparison notes.",
  rejected: "Closed applications can stay here for learning patterns.",
};

function getApplicationCards(): ApplicationCardData[] {
  return mockApplications
    .map((application) => {
      const job = mockJobs.find((item) => item.id === application.jobId);
      return job ? { application, job } : null;
    })
    .filter((entry): entry is ApplicationCardData => entry !== null);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function formatOverdue(label: string, days: number) {
  const overdueBy = Math.abs(days);
  return overdueBy === 1
    ? `${label} overdue by 1d`
    : `${label} overdue by ${overdueBy}d`;
}

function getWarnings(application: MockApplication, job: MockJob) {
  const warnings: string[] = [];
  const deadlineDays = daysUntil(job.deadline);

  if (deadlineDays < 0) {
    warnings.push(formatOverdue("Deadline", deadlineDays));
  }

  if (application.followUpDue) {
    const followUpDays = daysUntil(application.followUpDue);
    if (followUpDays < 0) {
      warnings.push(formatOverdue("Follow-up", followUpDays));
    }
  }

  return warnings;
}

function ApplicationCard({ application, job }: ApplicationCardData) {
  const warnings = getWarnings(application, job);
  const daysLeft = daysUntil(job.deadline);

  return (
    <Link
      href={`/jobs/${job.id}`}
      aria-label={`Open details for ${job.company} ${job.role}. Last action: ${application.lastAction}. Next action: ${application.nextAction}.`}
      title={`${application.lastAction} · ${application.nextAction}`}
      className="group block rounded-md border bg-background p-3 transition-colors hover:border-border-strong hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <article>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground group-hover:underline">
              {job.company}
            </p>
            <p className="mt-0.5 truncate text-xs leading-5 text-text-secondary">
              {job.role}
            </p>
          </div>
          <ArrowRight
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-brand"
            aria-hidden
          />
        </div>

        <div className="mt-2">
          <StatusBadge
            status={application.status}
            className="max-w-full overflow-hidden"
          />
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{job.location}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <DeadlineBadge
            daysLeft={daysLeft}
            label={formatDeadline(job.deadline)}
          />
          <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            <FileText className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{job.resumeVersion ?? "No resume yet"}</span>
          </span>
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
            {application.nextAction}
          </p>
        </div>
      </article>
    </Link>
  );
}

export default function ApplicationsPage() {
  const cards = getApplicationCards();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Applications"
        description="Track every Canadian co-op application from saved to final outcome."
        actions={
          <>
            <div
              className="flex items-center gap-1 rounded-md border bg-card p-1"
              aria-label="Application view options"
            >
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 rounded-md px-2.5"
              >
                <KanbanSquare className="size-3.5" aria-hidden />
                Board
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-md px-2.5 text-muted-foreground"
                aria-disabled="true"
                title="Table view placeholder"
              >
                <Table2 className="size-3.5" aria-hidden />
                Table
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 rounded-md px-2.5 text-muted-foreground"
                aria-disabled="true"
                title="Calendar view placeholder"
              >
                <CalendarRange className="size-3.5" aria-hidden />
                Calendar
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-md"
              aria-disabled="true"
              title="Add application placeholder"
            >
              <Plus className="size-3.5" aria-hidden />
              Add application
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Fall 2026 application board
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            SFU Engineering / CS search across Vancouver, Burnaby, Toronto, and
            Waterloo roles.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          <span>{pluralize(cards.length, "active application")}</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1260px] grid-cols-7 gap-3">
          {applicationColumns.map((column) => {
            const columnCards = cards.filter(
              ({ application }) => application.status === column.id,
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
                      {columnCards.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {column.helper}
                  </p>
                </header>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  {columnCards.length > 0 ? (
                    columnCards.map((card) => (
                      <ApplicationCard
                        key={card.application.id}
                        application={card.application}
                        job={card.job}
                      />
                    ))
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center">
                      <div className="flex size-9 items-center justify-center rounded-md bg-card">
                        <KanbanSquare
                          className="size-4 text-muted-foreground"
                          aria-hidden
                        />
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
    </div>
  );
}
