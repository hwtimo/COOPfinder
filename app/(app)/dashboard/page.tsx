import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { CardSection } from "@/components/app/card-section";
import { StatusBadge, DeadlineBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import {
  mockJobs,
  mockMetrics,
  mockPipelineStages,
  mockNextActions,
  mockResumePerformance,
  currentUser,
  daysUntil,
  formatDeadline,
} from "@/lib/mock";

const pipelineTone = {
  saved: "bg-muted-foreground",
  tailoring: "bg-info",
  ready: "bg-brand",
  applied: "bg-text-secondary",
  interview: "bg-success",
  offer: "bg-success",
  rejected: "bg-destructive",
};

export default function DashboardPage() {
  const upcoming = [...mockJobs]
    .filter((j) => daysUntil(j.deadline) >= 0 && j.status !== "rejected")
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
    .slice(0, 5);

  const recent = [...mockJobs]
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1))
    .slice(0, 6);

  const pipelineTotal = mockPipelineStages.reduce(
    (total, stage) => total + stage.count,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good morning, ${currentUser.name.split(" ")[0]}`}
        description={`${currentUser.term} search · ${currentUser.school} ${currentUser.program}`}
      />

      {/* Metric row — DESIGN.md §9.1 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {mockMetrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={m.value}
            helper={m.helper}
            tone={m.tone}
            actionLabel={m.actionLabel}
            actionHref={m.href}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <CardSection
            title="Application pipeline"
            description="From saved roles to final outcomes"
            action={
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/applications">
                  Open tracker
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </Button>
            }
          >
            <ul className="divide-y">
              {mockPipelineStages.map((stage) => {
                const width = Math.max(
                  8,
                  Math.round((stage.count / pipelineTotal) * 100),
                );

                return (
                  <li
                    key={stage.id}
                    className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)_150px] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${pipelineTone[stage.id]}`}
                          aria-hidden
                        />
                        <p className="text-sm font-medium text-foreground">
                          {stage.label}
                        </p>
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {stage.count}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {stage.helper}
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${pipelineTone[stage.id]}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <Link
                      href={stage.href}
                      className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:justify-self-end"
                    >
                      {stage.action}
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardSection>

          <CardSection
            title="Recent jobs"
            description="Newest saved co-op roles"
            contentClassName="p-0"
            action={
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/jobs">
                  View all
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </Button>
            }
          >
            {recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-5 py-2.5 font-medium">Role</th>
                      <th className="px-5 py-2.5 font-medium">Company</th>
                      <th className="px-5 py-2.5 font-medium">Location</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">
                        Resume version
                      </th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        Estimated match
                      </th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        Next action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recent.map((job) => (
                      <tr
                        key={job.id}
                        className="transition-colors hover:bg-muted/50"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href="/jobs"
                            className="rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {job.role}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {job.term}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {job.company}
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {job.location}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="px-5 py-3 text-text-secondary">
                          {job.resumeVersion ?? "Not tailored"}
                        </td>
                        <td className="px-5 py-3 text-right text-text-secondary tabular-nums">
                          {job.match === null ? "Not analyzed" : `${job.match}%`}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={
                              job.nextAction.includes("Tailor")
                                ? "/resumes"
                                : "/applications"
                            }
                            className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {job.nextAction}
                            <ArrowRight className="size-3" aria-hidden />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={Briefcase}
                  title="No recent jobs yet"
                  description="Save a Canadian co-op posting to analyze the role, tailor a resume, and track the next step."
                  actionLabel="Add first job"
                />
              </div>
            )}
          </CardSection>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <CardSection
            title="Upcoming deadlines"
            description="Closest open deadlines first"
            contentClassName="p-0"
            action={
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href="/jobs">
                  View all
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </Button>
            }
          >
            {upcoming.length > 0 ? (
              <ul className="divide-y">
                {upcoming.map((job) => (
                  <li key={job.id}>
                    <Link
                      href="/jobs"
                      className="block px-5 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {job.company}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {job.role} · {job.location}
                          </p>
                        </div>
                        <DeadlineBadge
                          daysLeft={daysUntil(job.deadline)}
                          label={formatDeadline(job.deadline)}
                          className="shrink-0"
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <StatusBadge status={job.status} />
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                          {job.nextAction}
                          <ArrowRight className="size-3" aria-hidden />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={CalendarClock}
                  title="No deadlines this week"
                  description="Add deadlines to saved jobs so the dashboard can keep the next application window visible."
                  actionLabel="Review saved jobs"
                  onActionHref="/jobs"
                />
              </div>
            )}
          </CardSection>

          <CardSection
            title="AI next actions"
            description="Suggested from saved jobs and reminders"
            contentClassName="p-3"
            action={
              /* Trust label per DESIGN.md §3.2 — plain, reviewable, no hype */
              <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                Suggested by AI
              </span>
            }
          >
            <ul className="space-y-1">
              {mockNextActions.map((action) => (
                <li key={action.id}>
                  <Link
                    href={action.href}
                    className="block rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {action.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {action.detail}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand">
                      {action.action}
                      <ArrowRight className="size-3" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardSection>

          <CardSection
            title="Resume performance"
            description={mockResumePerformance.helper}
            action={
              <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
                <Link href={mockResumePerformance.href}>
                  Review
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </Button>
            }
          >
            <dl className="grid gap-3">
              <div className="rounded-md border bg-background p-3">
                <dt className="text-xs text-muted-foreground">
                  Resume versions
                </dt>
                <dd className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                  {mockResumePerformance.versions}
                </dd>
              </div>
              <div className="rounded-md border bg-background p-3">
                <dt className="text-xs text-muted-foreground">
                  Estimated callback rate
                </dt>
                <dd className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                  {mockResumePerformance.estimatedCallbackRate}
                </dd>
              </div>
              <div className="rounded-md border bg-background p-3">
                <dt className="text-xs text-muted-foreground">
                  Most used version
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {mockResumePerformance.mostUsedVersion}
                </dd>
              </div>
            </dl>
            <Link
              href={mockResumePerformance.href}
              className="mt-4 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {mockResumePerformance.nextAction}
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </CardSection>
        </div>
      </div>
    </div>
  );
}
