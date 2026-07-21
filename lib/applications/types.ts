export const APPLICATION_TRACKER_COLUMNS = [
  { id: "saved", label: "Saved", helper: "Needs review" },
  { id: "tailoring", label: "Tailoring", helper: "Resume edits" },
  { id: "ready", label: "Ready", helper: "Can apply" },
  { id: "applied", label: "Applied", helper: "Waiting" },
  { id: "interview", label: "Interview", helper: "Prep and follow-up" },
  { id: "offer", label: "Offer", helper: "Decision notes" },
  { id: "rejected", label: "Rejected", helper: "Archive learnings" },
] as const;

export type ApplicationTrackerStatus =
  (typeof APPLICATION_TRACKER_COLUMNS)[number]["id"];

const applicationTrackerStatuses = new Set<string>(
  APPLICATION_TRACKER_COLUMNS.map((column) => column.id),
);

export function isApplicationTrackerStatus(
  value: unknown,
): value is ApplicationTrackerStatus {
  return typeof value === "string" && applicationTrackerStatuses.has(value);
}

export type ApplicationJobSummary = {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  workMode: string | null;
  deadline: string | null;
};

export type TrackerApplication = {
  id: string;
  jobPostingId: string;
  status: ApplicationTrackerStatus;
  deadline: string | null;
  followUpDue: string | null;
  appliedAt: string | null;
  lastAction: string | null;
  nextAction: string | null;
  createdAt: string;
  updatedAt: string;
  job: ApplicationJobSummary | null;
};

export type ApplicationTrackingLink = {
  id: string;
  jobPostingId: string;
  status: ApplicationTrackerStatus;
};

export type ApplicationTrackingLinksQueryResult =
  | { status: "ready"; data: ApplicationTrackingLink[] }
  | { status: "error"; data: [] };

export type ApplicationTrackingLinkQueryResult =
  | { status: "ready"; data: ApplicationTrackingLink | null }
  | { status: "error"; data: null };

export type EligibleApplicationJob = ApplicationJobSummary;

export type ApplicationTrackerData = {
  applications: TrackerApplication[];
  eligibleJobs: EligibleApplicationJob[];
  savedJobCount: number;
};

export type ApplicationTrackerQueryResult =
  | { status: "ready"; data: ApplicationTrackerData }
  | { status: "error"; data: ApplicationTrackerData };

export type ApplicationDetailJob = ApplicationJobSummary & {
  term: string | null;
  sourceUrl: string | null;
};

export type ApplicationTimelineEvent = {
  id: string;
  eventType: string;
  eventAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ApplicationDetail = {
  id: string;
  jobPostingId: string;
  status: ApplicationTrackerStatus;
  notes: string | null;
  deadline: string | null;
  followUpDue: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job: ApplicationDetailJob;
  timeline: ApplicationTimelineEvent[];
};

export type ApplicationDetailQueryResult =
  | { status: "ready"; data: ApplicationDetail | null }
  | { status: "error"; data: null };
