import type { ApplicationTrackerStatus } from "@/lib/applications/types";
import type { PrivateJobStatus } from "@/lib/jobs/types";

export type DashboardJob = {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  deadline: string | null;
  status: PrivateJobStatus;
  updatedAt: string;
};

export type DashboardApplication = {
  id: string;
  status: ApplicationTrackerStatus;
};

export type DashboardData = {
  jobs: DashboardJob[];
  applications: DashboardApplication[];
};

export type DashboardDataResult =
  | { status: "ready"; data: DashboardData }
  | { status: "error"; data: DashboardData };

export type DashboardPipelineStage = {
  id: ApplicationTrackerStatus;
  label: string;
  count: number;
};

export type DashboardViewModel = {
  totalJobs: number;
  totalApplications: number;
  upcomingDeadlineCount: number;
  recentJobs: DashboardJob[];
  upcomingJobs: DashboardJob[];
  pipeline: DashboardPipelineStage[];
};
