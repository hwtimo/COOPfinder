import "server-only";

import { isApplicationTrackerStatus } from "@/lib/applications/types";
import {
  PRIVATE_JOB_STATUSES,
  type PrivateJobStatus,
} from "@/lib/jobs/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  DashboardApplication,
  DashboardData,
  DashboardDataResult,
  DashboardJob,
} from "./types";

const EMPTY_DATA: DashboardData = { jobs: [], applications: [] };
const jobStatuses = new Set<string>(PRIVATE_JOB_STATUSES);

type CompanyRelation = { name: string };

type DashboardJobRow = {
  id: string;
  title: string;
  location: string | null;
  deadline: string | null;
  status: string;
  updated_at: string;
  company: CompanyRelation | CompanyRelation[] | null;
};

type DashboardApplicationRow = {
  id: string;
  status: string;
};

function companyName(
  relation: DashboardJobRow["company"],
): string | null {
  const company = Array.isArray(relation) ? relation[0] : relation;
  return company?.name ?? null;
}

function toDashboardJob(row: DashboardJobRow): DashboardJob | null {
  if (!jobStatuses.has(row.status)) return null;

  return {
    id: row.id,
    title: row.title,
    companyName: companyName(row.company),
    location: row.location,
    deadline: row.deadline,
    status: row.status as PrivateJobStatus,
    updatedAt: row.updated_at,
  };
}

function toDashboardApplication(
  row: DashboardApplicationRow,
): DashboardApplication | null {
  return isApplicationTrackerStatus(row.status)
    ? { id: row.id, status: row.status }
    : null;
}

export async function getDashboardData(
  userId: string,
): Promise<DashboardDataResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: EMPTY_DATA };

  const [jobsResult, applicationsResult] = await Promise.all([
    supabase
      .from("job_postings")
      .select(
        "id,title,location,deadline,status,updated_at,company:companies!job_postings_company_id_fkey(name)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("applications")
      .select("id,status")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (jobsResult.error || applicationsResult.error) {
    return { status: "error", data: EMPTY_DATA };
  }

  const jobs = ((jobsResult.data ?? []) as unknown as DashboardJobRow[]).map(
    toDashboardJob,
  );
  const applications = (
    (applicationsResult.data ?? []) as unknown as DashboardApplicationRow[]
  ).map(toDashboardApplication);

  if (
    jobs.some((job) => job === null) ||
    applications.some((application) => application === null)
  ) {
    return { status: "error", data: EMPTY_DATA };
  }

  return {
    status: "ready",
    data: {
      jobs: jobs as DashboardJob[],
      applications: applications as DashboardApplication[],
    },
  };
}
