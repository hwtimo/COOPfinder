export const PRIVATE_JOB_STATUSES = [
  "saved",
  "tailoring",
  "ready",
  "applied",
  "oa",
  "interview",
  "offer",
  "rejected",
] as const;

export type PrivateJobStatus = (typeof PRIVATE_JOB_STATUSES)[number];

export const PRIVATE_JOB_WORK_MODES = ["Remote", "Hybrid", "On-site"] as const;
export type PrivateJobWorkMode = (typeof PRIVATE_JOB_WORK_MODES)[number];

export const PRIVATE_JOB_WORK_AUTHORIZATIONS = [
  "Canadian work authorization",
  "Domestic students",
  "International eligible",
] as const;

export type PrivateJobWorkAuthorization =
  (typeof PRIVATE_JOB_WORK_AUTHORIZATIONS)[number];

export type PrivateJobIntakeSource =
  | "pasted_url"
  | "pasted_text"
  | "board_save"
  | "manual";

export type PrivateJob = {
  id: string;
  title: string;
  companyId: string | null;
  companyName: string | null;
  roleType: string | null;
  location: string | null;
  term: string | null;
  workMode: PrivateJobWorkMode | null;
  deadline: string | null;
  sourceUrl: string | null;
  rawText: string | null;
  matchScore: number | null;
  status: PrivateJobStatus;
  coopEligible: boolean;
  workAuthorization: PrivateJobWorkAuthorization | null;
  notes: string | null;
  intakeSource: PrivateJobIntakeSource;
  boardJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrivateJobDetail = PrivateJob & {
  extracted: unknown;
  extractionConfidence: number | null;
};

export type PrivateJobsQueryResult<T> =
  | { status: "ready"; data: T }
  | { status: "error"; data: T };
