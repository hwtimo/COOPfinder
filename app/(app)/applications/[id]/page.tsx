import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileText,
  History,
  MapPin,
  NotebookText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/app/card-section";
import { PageHeader } from "@/components/app/page-header";
import { DeadlineBadge, StatusBadge } from "@/components/app/status-badge";
import {
  daysUntil,
  formatDeadline,
  mockApplicationTimeline,
  mockApplications,
  mockJobs,
  mockResumeVersions,
  type MockApplication,
  type MockApplicationTimelineItem,
  type MockJob,
} from "@/lib/mock";

type ApplicationDetailPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return mockApplications.map((application) => ({ id: application.id }));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

function getTimeline(
  application: MockApplication,
  job: MockJob,
): MockApplicationTimelineItem[] {
  const explicitTimeline = mockApplicationTimeline.filter(
    (item) => item.applicationId === application.id,
  );

  if (explicitTimeline.length > 0) {
    return explicitTimeline;
  }

  return [
    {
      id: `${application.id}-saved`,
      applicationId: application.id,
      label: "Application record created",
      detail: application.lastAction,
      date: job.updatedAt,
    },
    {
      id: `${application.id}-next`,
      applicationId: application.id,
      label: "Next action queued",
      detail: application.nextAction,
      date: job.updatedAt,
    },
  ];
}

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

function resumeTarget(job: MockJob) {
  const resumeVersion = mockResumeVersions.find(
    (version) => version.name === job.resumeVersion,
  );

  if (resumeVersion) {
    return {
      href: "/resumes",
      label: resumeVersion.name,
      helper: resumeVersion.notes,
    };
  }

  return {
    href: `/resumes/tailor/${job.id}`,
    label: "Create tailored resume",
    helper: "No resume version is attached to this application yet.",
  };
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const { id } = await params;
  const application = mockApplications.find((item) => item.id === id);

  if (!application) {
    notFound();
  }

  const job = mockJobs.find((item) => item.id === application.jobId);

  if (!job) {
    notFound();
  }

  const timeline = getTimeline(application, job);
  const resume = resumeTarget(job);
  const deadlineDays = daysUntil(job.deadline);
  const followUpDays = application.followUpDue
    ? daysUntil(application.followUpDue)
    : null;
  const followUpLabel = application.followUpDue
    ? formatDeadline(application.followUpDue)
    : "No follow-up set";

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
        title={`${job.company} application`}
        description={`${job.role} - ${job.location}`}
        actions={<StatusBadge status={application.status} />}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                    Fall 2026 tracker
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  {job.role}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                  {job.description}
                </p>
              </div>
              <DeadlineBadge
                daysLeft={deadlineDays}
                label={formatDeadline(job.deadline)}
              />
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailItem label="Company">{job.company}</DetailItem>
              <DetailItem label="Location">{job.location}</DetailItem>
              <DetailItem label="Term">{job.term}</DetailItem>
              <DetailItem label="Work mode">{job.workMode}</DetailItem>
            </dl>
          </section>

          <CardSection
            title="Application progress"
            description="Where this application stands and what should happen next"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <History className="size-3.5" aria-hidden />
                  Last action
                </div>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  {application.lastAction}
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Next action
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                  {application.nextAction}
                </p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden />
                  Follow-up
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {followUpLabel}
                </p>
                {followUpDays !== null && followUpDays < 0 ? (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Follow-up is overdue.
                  </p>
                ) : null}
              </div>
            </div>
          </CardSection>

          <CardSection
            title="Timeline"
            description="Activity history for this application"
          >
            <ol className="space-y-4">
              {timeline.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                    <span
                      className="size-2 rounded-full bg-brand"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1 rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {formatDate(item.date)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardSection>

          <CardSection
            title="Notes"
            description="Saved context from the job record"
          >
            <div className="flex gap-3 rounded-md border bg-background p-4">
              <NotebookText
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <p className="text-sm leading-6 text-text-secondary">
                {job.notes}
              </p>
            </div>
          </CardSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <CardSection title="Next step" description="Keep the workflow moving">
            <div className="space-y-4">
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Application status
                </p>
                <div className="mt-2">
                  <StatusBadge status={application.status} />
                </div>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  Estimated match
                </p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                  {job.match === null ? "Not analyzed" : `${job.match}%`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Estimated match is directional only.
                </p>
              </div>
              <Button asChild className="h-9 w-full rounded-md">
                <Link href={`/jobs/${job.id}`}>
                  <Briefcase className="size-4" aria-hidden />
                  View job detail
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-9 w-full rounded-md"
              >
                <Link href={resume.href}>
                  <FileText className="size-4" aria-hidden />
                  {resume.label}
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-9 w-full rounded-md"
              >
                <Link href="/applications">
                  <ArrowLeft className="size-4" aria-hidden />
                  Return to tracker
                </Link>
              </Button>
            </div>
          </CardSection>

          <CardSection title="Resume context" contentClassName="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Attached version</p>
              <Link
                href={resume.href}
                className="mt-1 inline-flex items-center gap-1 rounded-sm text-sm font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {resume.label}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              {resume.helper}
            </p>
          </CardSection>

          <CardSection title="Job facts" contentClassName="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {job.location}
                </p>
                <p className="text-xs text-muted-foreground">
                  {job.workMode} - {job.term}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-text-secondary">
              {job.workAuthorization}
            </div>
          </CardSection>
        </aside>
      </div>
    </div>
  );
}
