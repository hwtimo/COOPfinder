import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  APPLICATION_TRACKER_COLUMNS,
  type ApplicationJobSummary,
  type ApplicationTrackerData,
  type ApplicationTrackerQueryResult,
  type ApplicationTrackerStatus,
  type TrackerApplication,
} from "./types";

const APPLICATION_COLUMNS = [
  "id",
  "job_posting_id",
  "status",
  "deadline",
  "follow_up_due",
  "applied_at",
  "last_action",
  "next_action",
  "sort_order",
  "created_at",
  "updated_at",
].join(",");

const JOB_DISPLAY_COLUMNS = [
  "id",
  "title",
  "location",
  "work_mode",
  "deadline",
  "status",
  "updated_at",
  "company:companies!job_postings_company_id_fkey(name)",
].join(",");

const EMPTY_DATA: ApplicationTrackerData = {
  applications: [],
  eligibleJobs: [],
  savedJobCount: 0,
};

type ApplicationRow = {
  id: string;
  job_posting_id: string;
  status: string;
  deadline: string | null;
  follow_up_due: string | null;
  applied_at: string | null;
  last_action: string | null;
  next_action: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type CompanyRelation = { name: string };

type JobDisplayRow = {
  id: string;
  title: string;
  location: string | null;
  work_mode: string | null;
  deadline: string | null;
  status: string;
  updated_at: string;
  company: CompanyRelation | CompanyRelation[] | null;
};

const canonicalStatuses = new Set<string>(
  APPLICATION_TRACKER_COLUMNS.map((column) => column.id),
);

function isTrackerStatus(value: string): value is ApplicationTrackerStatus {
  return canonicalStatuses.has(value);
}

function companyName(relation: JobDisplayRow["company"]): string | null {
  const company = Array.isArray(relation) ? relation[0] : relation;
  return company?.name ?? null;
}

function toJobSummary(row: JobDisplayRow): ApplicationJobSummary {
  return {
    id: row.id,
    title: row.title,
    companyName: companyName(row.company),
    location: row.location,
    workMode: row.work_mode,
    deadline: row.deadline,
  };
}

export async function getApplicationTrackerData(
  userId: string,
): Promise<ApplicationTrackerQueryResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: EMPTY_DATA };

  const [applicationsResult, jobsResult] = await Promise.all([
    supabase
      .from("applications")
      .select(APPLICATION_COLUMNS)
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("job_postings")
      .select(JOB_DISPLAY_COLUMNS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
  ]);

  if (applicationsResult.error || jobsResult.error) {
    return { status: "error", data: EMPTY_DATA };
  }

  const applicationRows = (applicationsResult.data ?? []) as unknown as ApplicationRow[];
  const jobRows = (jobsResult.data ?? []) as unknown as JobDisplayRow[];

  if (applicationRows.some((row) => !isTrackerStatus(row.status))) {
    return { status: "error", data: EMPTY_DATA };
  }

  const jobsById = new Map(
    jobRows.map((row) => [row.id, toJobSummary(row)] as const),
  );
  const trackedJobIds = new Set(
    applicationRows.map((application) => application.job_posting_id),
  );
  const savedJobs = jobRows.filter((job) => job.status === "saved");

  const applications: TrackerApplication[] = applicationRows.map((row) => ({
    id: row.id,
    jobPostingId: row.job_posting_id,
    status: row.status as ApplicationTrackerStatus,
    deadline: row.deadline,
    followUpDue: row.follow_up_due,
    appliedAt: row.applied_at,
    lastAction: row.last_action,
    nextAction: row.next_action,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    job: jobsById.get(row.job_posting_id) ?? null,
  }));

  return {
    status: "ready",
    data: {
      applications,
      eligibleJobs: savedJobs
        .filter((job) => !trackedJobIds.has(job.id))
        .map(toJobSummary),
      savedJobCount: savedJobs.length,
    },
  };
}
