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

export type EligibleApplicationJob = ApplicationJobSummary;

export type ApplicationTrackerData = {
  applications: TrackerApplication[];
  eligibleJobs: EligibleApplicationJob[];
  savedJobCount: number;
};

export type ApplicationTrackerQueryResult =
  | { status: "ready"; data: ApplicationTrackerData }
  | { status: "error"; data: ApplicationTrackerData };
