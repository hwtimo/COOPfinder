import { APPLICATION_TRACKER_COLUMNS } from "@/lib/applications/types";
import { daysUntilPrivateJobDeadline } from "@/lib/jobs/dates";

import type {
  DashboardData,
  DashboardJob,
  DashboardViewModel,
} from "./types";
import type { ApplicationTrackerStatus } from "@/lib/applications/types";

function byUpdatedAtThenId(a: DashboardJob, b: DashboardJob): number {
  const updated = b.updatedAt.localeCompare(a.updatedAt);
  return updated || a.id.localeCompare(b.id);
}

function byDeadlineThenId(a: DashboardJob, b: DashboardJob): number {
  const deadline = (a.deadline ?? "").localeCompare(b.deadline ?? "");
  return deadline || a.id.localeCompare(b.id);
}

export function buildDashboardViewModel(
  data: DashboardData,
  now = new Date(),
): DashboardViewModel {
  const upcomingJobs = data.jobs
    .filter((job) => {
      const days = daysUntilPrivateJobDeadline(job.deadline, now);
      return days !== null && days >= 0 && job.status !== "rejected";
    })
    .sort(byDeadlineThenId);
  const applicationCounts = new Map<ApplicationTrackerStatus, number>(
    APPLICATION_TRACKER_COLUMNS.map((column) => [column.id, 0] as const),
  );

  data.applications.forEach((application) => {
    applicationCounts.set(
      application.status,
      (applicationCounts.get(application.status) ?? 0) + 1,
    );
  });

  return {
    totalJobs: data.jobs.length,
    totalApplications: data.applications.length,
    upcomingDeadlineCount: upcomingJobs.length,
    recentJobs: [...data.jobs].sort(byUpdatedAtThenId).slice(0, 6),
    upcomingJobs: upcomingJobs.slice(0, 5),
    pipeline: APPLICATION_TRACKER_COLUMNS.map((column) => ({
      id: column.id,
      label: column.label,
      count: applicationCounts.get(column.id) ?? 0,
    })),
  };
}
