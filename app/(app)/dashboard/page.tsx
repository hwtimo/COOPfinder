import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { CardSection } from "@/components/app/card-section";
import { DashboardRecentJobRow } from "@/components/app/dashboard-recent-job-row";
import { EmptyState } from "@/components/app/empty-state";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getLoginHref } from "@/lib/auth/paths";
import { getDashboardData } from "@/lib/dashboard/queries";
import { buildDashboardViewModel } from "@/lib/dashboard/view-model";
import {
  daysUntilPrivateJobDeadline,
  formatPrivateJobDeadline,
} from "@/lib/jobs/dates";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { getSupabaseUser } from "@/lib/supabase/user";

import type { ApplicationTrackerStatus } from "@/lib/applications/types";

export const dynamic = "force-dynamic";

const pipelineTone: Record<ApplicationTrackerStatus, string> = {
  saved: "bg-muted-foreground",
  tailoring: "bg-info",
  ready: "bg-brand",
  applied: "bg-text-secondary",
  interview: "bg-success",
  offer: "bg-success",
  rejected: "bg-destructive",
};

function DashboardUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your saved jobs and application activity."
      />
      <EmptyState
        icon={AlertTriangle}
        title={title}
        description={description}
      />
    </div>
  );
}

export default async function DashboardPage() {
  if (!getSupabaseEnv()) {
    return (
      <DashboardUnavailable
        title="Dashboard unavailable"
        description="Supabase is not configured for this build. No saved-job or application data can be shown."
      />
    );
  }

  const user = await getSupabaseUser();
  if (!user) redirect(getLoginHref("/dashboard"));

  const result = await getDashboardData(user.id);
  if (result.status === "error") {
    return (
      <DashboardUnavailable
        title="Dashboard could not load"
        description="Your private jobs and applications are temporarily unavailable. No fallback data is shown."
      />
    );
  }

  const now = new Date();
  const dashboard = buildDashboardViewModel(result.data, now);
  const pipelineTotal = dashboard.totalApplications;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your saved jobs and application activity."
      />

      {dashboard.mode === "onboarding" ? (
        <CardSection
          title="Getting started"
          description="Complete these persisted workspace milestones in order"
          action={
            <Button asChild size="sm">
              <Link href={dashboard.primaryAction.href}>
                {dashboard.primaryAction.title}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
          }
        >
          <ol className="grid gap-3 sm:grid-cols-2">
            {dashboard.onboardingMilestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex items-center gap-3 border border-border p-3"
              >
                {milestone.complete ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-success"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {milestone.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {milestone.complete ? "Complete" : "Not complete"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            {dashboard.primaryAction.description}
          </p>
        </CardSection>
      ) : (
        <>
          <CardSection
            title="Next action"
            description="Deterministic from your persisted workspace state"
            action={
              <Button asChild size="sm">
                <Link href={dashboard.primaryAction.href}>
                  Open
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <h2 className="text-base font-semibold text-foreground">
              {dashboard.primaryAction.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboard.primaryAction.description}
            </p>
            {dashboard.queuedActions.length > 0 ? (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Queued
                </p>
                <ul className="mt-2 space-y-2">
                  {dashboard.queuedActions.map((action) => (
                    <li key={action.id}>
                      <Link
                        href={action.href}
                        className="flex items-center justify-between gap-3 text-sm text-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>{action.title}</span>
                        <ArrowRight
                          className="size-3.5 shrink-0"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardSection>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              label="Saved jobs"
              value={dashboard.totalJobs}
              helper="Private jobs in your workspace"
              actionLabel="View jobs"
              actionHref="/jobs"
            />
            <MetricCard
              label="Tracked applications"
              value={dashboard.totalApplications}
              helper="Applications in your tracker"
              actionLabel="Open tracker"
              actionHref="/applications"
            />
            <MetricCard
              label="Upcoming deadlines"
              value={dashboard.upcomingDeadlineCount}
              helper="Open saved-job deadlines"
              actionLabel="Review jobs"
              actionHref="/jobs"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <CardSection
                title="Application pipeline"
                description="Persisted applications grouped by current status"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 text-xs"
                  >
                    <Link href="/applications">
                      Open tracker
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  </Button>
                }
              >
                {pipelineTotal > 0 ? (
                  <ul className="divide-y">
                    {dashboard.pipeline.map((stage) => {
                      const width = Math.round(
                        (stage.count / pipelineTotal) * 100,
                      );

                      return (
                        <li
                          key={stage.id}
                          className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)] md:items-center"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`size-1.5 shrink-0 rounded-full ${pipelineTone[stage.id]}`}
                              aria-hidden
                            />
                            <p className="truncate text-sm font-medium text-foreground">
                              {stage.label}
                            </p>
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {stage.count}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${pipelineTone[stage.id]}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No applications are being tracked yet.
                  </p>
                )}
              </CardSection>

              <CardSection
                title="Recent jobs"
                description="Most recently updated private jobs"
                contentClassName="p-0"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 text-xs"
                  >
                    <Link href="/jobs">
                      View all
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  </Button>
                }
              >
                {dashboard.recentJobs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-5 py-2.5 font-medium">Role</th>
                          <th className="px-5 py-2.5 font-medium">Company</th>
                          <th className="px-5 py-2.5 font-medium">Location</th>
                          <th className="px-5 py-2.5 font-medium">Status</th>
                          <th className="px-5 py-2.5 font-medium">Deadline</th>
                          <th className="px-5 py-2.5 text-right font-medium">
                            Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {dashboard.recentJobs.map((job) => (
                          <DashboardRecentJobRow key={job.id} job={job} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-5 text-sm text-muted-foreground">
                    No saved jobs are available.
                  </p>
                )}
              </CardSection>
            </div>

            <div className="space-y-4 xl:col-span-4">
              <CardSection
                title="Upcoming deadlines"
                description="Closest open saved-job deadlines"
                contentClassName="p-0"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 text-xs"
                  >
                    <Link href="/jobs">
                      View all
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  </Button>
                }
              >
                {dashboard.upcomingJobs.length > 0 ? (
                  <ul className="divide-y">
                    {dashboard.upcomingJobs.map((job) => {
                      const daysLeft = daysUntilPrivateJobDeadline(
                        job.deadline,
                        now,
                      );

                      return (
                        <li key={job.id}>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="block px-5 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {job.title}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {job.companyName ?? "Company not added"}
                                  {job.location ? ` · ${job.location}` : ""}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                                {formatPrivateJobDeadline(job.deadline, now)}
                              </span>
                            </div>
                            <span className="sr-only">
                              {daysLeft === null
                                ? "No deadline"
                                : `${daysLeft} days remaining`}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <CalendarClock
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <p className="text-sm text-muted-foreground">
                        No upcoming saved-job deadlines are available.
                      </p>
                    </div>
                  </div>
                )}
              </CardSection>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
