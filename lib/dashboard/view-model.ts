import { APPLICATION_TRACKER_COLUMNS } from "@/lib/applications/types";
import { daysUntilPrivateJobDeadline } from "@/lib/jobs/dates";

import type {
  DashboardApplication,
  DashboardData,
  DashboardJob,
  DashboardNextAction,
  DashboardOnboardingMilestone,
  DashboardViewModel,
} from "./types";
import type { ApplicationTrackerStatus } from "@/lib/applications/types";

type ActionCandidate = {
  action: DashboardNextAction;
  priority: number;
  deadline: string | null;
  updatedAt: string;
};

function byUpdatedAtThenId(a: DashboardJob, b: DashboardJob): number {
  const updated = b.updatedAt.localeCompare(a.updatedAt);
  return updated || a.id.localeCompare(b.id);
}

function byDeadlineThenId(a: DashboardJob, b: DashboardJob): number {
  const deadline = (a.deadline ?? "").localeCompare(b.deadline ?? "");
  return deadline || a.id.localeCompare(b.id);
}

function byActionPriority(a: ActionCandidate, b: ActionCandidate): number {
  if (a.priority !== b.priority) return a.priority - b.priority;

  const aDeadline = a.deadline ?? "9999-12-31";
  const bDeadline = b.deadline ?? "9999-12-31";
  const deadline = aDeadline.localeCompare(bDeadline);
  if (deadline) return deadline;

  const updated = a.updatedAt.localeCompare(b.updatedAt);
  return updated || a.action.id.localeCompare(b.action.id);
}

function onboardingAction(
  milestone: DashboardOnboardingMilestone,
): DashboardNextAction {
  const actions: Record<
    DashboardOnboardingMilestone["id"],
    Omit<DashboardNextAction, "id">
  > = {
    profile: {
      kind: "complete_profile",
      title: "Create your Master Profile",
      description:
        "Save factual profile details before comparing jobs or tailoring a resume.",
      href: "/resumes/master",
    },
    first_job: {
      kind: "save_job",
      title: "Save your first job",
      description: "Add a private job posting to continue your setup.",
      href: "/jobs",
    },
    first_analysis: {
      kind: "analyze_job",
      title: "Analyze your first job",
      description:
        "Add the job description and run the existing requirement analysis.",
      href: milestone.href,
    },
    first_tailored_resume: {
      kind: "tailor_resume",
      title: "Create your first tailored resume",
      description:
        "Review tailoring preflight for an analyzed job before generating.",
      href: milestone.href,
    },
  };

  return { id: `onboarding:${milestone.id}`, ...actions[milestone.id] };
}

function buildOnboardingMilestones(
  data: DashboardData,
): DashboardOnboardingMilestone[] {
  const firstJob = [...data.jobs].sort(byUpdatedAtThenId)[0];
  const firstAnalyzedJob = [...data.jobs]
    .filter((job) => job.hasAnalysis)
    .sort(byUpdatedAtThenId)[0];
  const firstVersion = [...data.resumeVersions].sort((a, b) => {
    const created = b.createdAt.localeCompare(a.createdAt);
    return created || a.id.localeCompare(b.id);
  })[0];

  return [
    {
      id: "profile",
      label: "Create Master Profile",
      complete: data.hasMasterProfile,
      href: "/resumes/master",
    },
    {
      id: "first_job",
      label: "Save first job",
      complete: data.jobs.length > 0,
      href: firstJob ? `/jobs/${firstJob.id}` : "/jobs",
    },
    {
      id: "first_analysis",
      label: "Analyze first job",
      complete: Boolean(firstAnalyzedJob),
      href: firstAnalyzedJob
        ? `/jobs/${firstAnalyzedJob.id}`
        : firstJob
          ? `/jobs/${firstJob.id}`
          : "/jobs",
    },
    {
      id: "first_tailored_resume",
      label: "Create first tailored resume",
      complete: Boolean(firstVersion),
      href: firstVersion
        ? `/resumes/versions/${firstVersion.id}`
        : firstAnalyzedJob
          ? `/resumes/tailor/${firstAnalyzedJob.id}`
          : "/jobs",
    },
  ];
}

function activeJobAction(
  job: DashboardJob,
  application: DashboardApplication | undefined,
  hasResumeVersion: boolean,
): ActionCandidate | null {
  if (job.status === "offer" || job.status === "rejected") return null;

  if (job.intakeSource === "pasted_url" && !job.hasRawText) {
    return {
      action: {
        id: `add-job-text:${job.id}`,
        kind: "add_job_text",
        title: "Paste the saved job description",
        description: `${job.title} needs manual text before analysis is available.`,
        href: `/jobs/${job.id}`,
      },
      priority: 10,
      deadline: job.deadline,
      updatedAt: job.updatedAt,
    };
  }

  if (job.hasRawText && !job.hasAnalysis) {
    return {
      action: {
        id: `analyze-job:${job.id}`,
        kind: "analyze_job",
        title: "Analyze a saved job",
        description: `Review and analyze the saved description for ${job.title}.`,
        href: `/jobs/${job.id}`,
      },
      priority: 20,
      deadline: job.deadline,
      updatedAt: job.updatedAt,
    };
  }

  if (job.hasAnalysis && !hasResumeVersion) {
    return {
      action: {
        id: `tailor-resume:${job.id}`,
        kind: "tailor_resume",
        title: "Review tailoring preflight",
        description: `Review confirmed evidence for ${job.title} before generating.`,
        href: `/resumes/tailor/${job.id}`,
      },
      priority: 30,
      deadline: job.deadline,
      updatedAt: job.updatedAt,
    };
  }

  if (job.hasAnalysis && hasResumeVersion && !application) {
    return {
      action: {
        id: `start-tracking:${job.id}`,
        kind: "start_tracking",
        title: "Start tracking an application",
        description: `Create an application record for ${job.title}.`,
        href: `/jobs/${job.id}`,
      },
      priority: 40,
      deadline: job.deadline,
      updatedAt: job.updatedAt,
    };
  }

  if (
    application &&
    application.status !== "offer" &&
    application.status !== "rejected"
  ) {
    return {
      action: {
        id: `review-application:${application.id}`,
        kind: "review_application",
        title: "Review a tracked application",
        description: `Open the persisted application record for ${job.title}.`,
        href: `/applications/${application.id}`,
      },
      priority: 50,
      deadline: job.deadline,
      updatedAt: application.updatedAt,
    };
  }

  return null;
}

function activeActions(data: DashboardData): DashboardNextAction[] {
  const applicationsByJob = new Map(
    data.applications.map((application) => [
      application.jobPostingId,
      application,
    ]),
  );
  const jobsWithResumeVersions = new Set(
    data.resumeVersions.flatMap((version) =>
      version.jobPostingId ? [version.jobPostingId] : [],
    ),
  );
  const actions = data.jobs
    .map((job) =>
      activeJobAction(
        job,
        applicationsByJob.get(job.id),
        jobsWithResumeVersions.has(job.id),
      ),
    )
    .filter((candidate): candidate is ActionCandidate => candidate !== null)
    .sort(byActionPriority)
    .map((candidate) => candidate.action);

  return actions.length > 0
    ? actions
    : [
        {
          id: "review-jobs",
          kind: "review_jobs",
          title: "Review your saved jobs",
          description:
            "Open your persisted jobs and applications to choose what to update next.",
          href: "/jobs",
        },
      ];
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
  const onboardingMilestones = buildOnboardingMilestones(data);
  const incompleteMilestone = onboardingMilestones.find(
    (milestone) => !milestone.complete,
  );
  const mode = incompleteMilestone ? "onboarding" : "active";
  const actions =
    mode === "active"
      ? activeActions(data)
      : [onboardingAction(incompleteMilestone!)];

  return {
    mode,
    onboardingMilestones,
    primaryAction: actions[0],
    queuedActions: mode === "active" ? actions.slice(1, 4) : [],
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
