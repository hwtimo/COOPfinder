import type { ApplicationTrackerStatus } from "@/lib/applications/types";
import type {
  PrivateJobIntakeSource,
  PrivateJobStatus,
} from "@/lib/jobs/types";

export type DashboardJob = {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  deadline: string | null;
  status: PrivateJobStatus;
  intakeSource: PrivateJobIntakeSource;
  hasRawText: boolean;
  hasAnalysis: boolean;
  updatedAt: string;
};

export type DashboardApplication = {
  id: string;
  jobPostingId: string;
  status: ApplicationTrackerStatus;
  updatedAt: string;
};

export type DashboardResumeVersion = {
  id: string;
  jobPostingId: string | null;
  createdAt: string;
};

export type DashboardData = {
  hasMasterProfile: boolean;
  jobs: DashboardJob[];
  applications: DashboardApplication[];
  resumeVersions: DashboardResumeVersion[];
};

export type DashboardDataResult =
  | { status: "ready"; data: DashboardData }
  | { status: "error"; data: DashboardData };

export type DashboardPipelineStage = {
  id: ApplicationTrackerStatus;
  label: string;
  count: number;
};

export type DashboardOnboardingMilestoneId =
  | "profile"
  | "first_job"
  | "first_analysis"
  | "first_tailored_resume";

export type DashboardOnboardingMilestone = {
  id: DashboardOnboardingMilestoneId;
  label: string;
  complete: boolean;
  href: string;
};

export type DashboardNextActionKind =
  | "complete_profile"
  | "save_job"
  | "add_job_text"
  | "analyze_job"
  | "tailor_resume"
  | "start_tracking"
  | "review_application"
  | "review_jobs";

export type DashboardNextAction = {
  id: string;
  kind: DashboardNextActionKind;
  title: string;
  description: string;
  href: string;
};

export type DashboardViewModel = {
  mode: "onboarding" | "active";
  onboardingMilestones: DashboardOnboardingMilestone[];
  primaryAction: DashboardNextAction;
  queuedActions: DashboardNextAction[];
  totalJobs: number;
  totalApplications: number;
  upcomingDeadlineCount: number;
  recentJobs: DashboardJob[];
  upcomingJobs: DashboardJob[];
  pipeline: DashboardPipelineStage[];
};
