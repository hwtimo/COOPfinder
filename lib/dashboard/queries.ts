import "server-only";

import { isApplicationTrackerStatus } from "@/lib/applications/types";
import {
  PRIVATE_JOB_STATUSES,
  type PrivateJobIntakeSource,
  type PrivateJobStatus,
} from "@/lib/jobs/types";
import { parseJobExtractionOutput } from "@/lib/ai/schemas/job-extraction";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTailoredResumeVersionContent } from "@/lib/tailoring/tailored-resume-version-content";

import type {
  DashboardApplication,
  DashboardData,
  DashboardDataResult,
  DashboardJob,
  DashboardResumeVersion,
} from "./types";

const EMPTY_DATA: DashboardData = {
  hasMasterProfile: false,
  jobs: [],
  applications: [],
  resumeVersions: [],
};
const jobStatuses = new Set<string>(PRIVATE_JOB_STATUSES);
const jobIntakeSources = new Set<string>([
  "pasted_url",
  "pasted_text",
  "board_save",
  "manual",
]);

type CompanyRelation = { name: string };

type DashboardJobRow = {
  id: string;
  title: string;
  location: string | null;
  deadline: string | null;
  status: string;
  intake_source: string;
  raw_text: string | null;
  extracted: unknown;
  updated_at: string;
  company: CompanyRelation | CompanyRelation[] | null;
};

type DashboardApplicationRow = {
  id: string;
  job_posting_id: string;
  status: string;
  updated_at: string;
};

type DashboardResumeVersionRow = {
  id: string;
  job_posting_id: string | null;
  created_at: string;
  content: unknown;
};

function companyName(
  relation: DashboardJobRow["company"],
): string | null {
  const company = Array.isArray(relation) ? relation[0] : relation;
  return company?.name ?? null;
}

function toDashboardJob(row: DashboardJobRow): DashboardJob | null {
  if (
    !jobStatuses.has(row.status) ||
    !jobIntakeSources.has(row.intake_source)
  ) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    companyName: companyName(row.company),
    location: row.location,
    deadline: row.deadline,
    status: row.status as PrivateJobStatus,
    intakeSource: row.intake_source as PrivateJobIntakeSource,
    hasRawText:
      typeof row.raw_text === "string" && row.raw_text.trim().length > 0,
    hasAnalysis: parseJobExtractionOutput(row.extracted).status === "valid",
    updatedAt: row.updated_at,
  };
}

function toDashboardApplication(
  row: DashboardApplicationRow,
): DashboardApplication | null {
  return isApplicationTrackerStatus(row.status) &&
    typeof row.job_posting_id === "string" &&
    typeof row.updated_at === "string"
    ? {
        id: row.id,
        jobPostingId: row.job_posting_id,
        status: row.status,
        updatedAt: row.updated_at,
      }
    : null;
}

function toDashboardResumeVersion(
  row: DashboardResumeVersionRow,
): DashboardResumeVersion | null {
  return typeof row.id === "string" &&
    (row.job_posting_id === null || typeof row.job_posting_id === "string") &&
    typeof row.created_at === "string" &&
    parseTailoredResumeVersionContent(row.content).status === "valid"
    ? {
        id: row.id,
        jobPostingId: row.job_posting_id,
        createdAt: row.created_at,
      }
    : null;
}

export async function getDashboardData(
  userId: string,
): Promise<DashboardDataResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: EMPTY_DATA };

  const [profileResult, jobsResult, applicationsResult, versionsResult] =
    await Promise.all([
      supabase
        .from("master_profiles")
        .select("id")
        .eq("user_id", userId)
        .limit(1),
    supabase
      .from("job_postings")
      .select(
          "id,title,location,deadline,status,intake_source,raw_text,extracted,updated_at,company:companies!job_postings_company_id_fkey(name)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
    supabase
      .from("applications")
        .select("id,job_posting_id,status,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
      supabase
        .from("resume_versions")
        .select("id,job_posting_id,created_at,content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }),
    ]);

  if (
    profileResult.error ||
    jobsResult.error ||
    applicationsResult.error ||
    versionsResult.error
  ) {
    return { status: "error", data: EMPTY_DATA };
  }

  const jobs = ((jobsResult.data ?? []) as unknown as DashboardJobRow[]).map(
    toDashboardJob,
  );
  const applications = (
    (applicationsResult.data ?? []) as unknown as DashboardApplicationRow[]
  ).map(toDashboardApplication);
  const resumeVersions = (
    (versionsResult.data ?? []) as unknown as DashboardResumeVersionRow[]
  ).map(toDashboardResumeVersion);

  if (
    jobs.some((job) => job === null) ||
    applications.some((application) => application === null) ||
    resumeVersions.some((version) => version === null)
  ) {
    return { status: "error", data: EMPTY_DATA };
  }

  return {
    status: "ready",
    data: {
      hasMasterProfile: (profileResult.data ?? []).length > 0,
      jobs: jobs as DashboardJob[],
      applications: applications as DashboardApplication[],
      resumeVersions: resumeVersions as DashboardResumeVersion[],
    },
  };
}
