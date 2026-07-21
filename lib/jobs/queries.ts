import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  PrivateJob,
  PrivateJobDetail,
  PrivateJobIntakeSource,
  PrivateJobsQueryResult,
  PrivateJobStatus,
  PrivateJobWorkAuthorization,
  PrivateJobWorkMode,
} from "./types";

const PRIVATE_JOB_COLUMNS = [
  "id",
  "title",
  "role_type",
  "location",
  "term",
  "work_mode",
  "deadline",
  "source_url",
  "raw_text",
  "match_score",
  "status",
  "coop_eligible",
  "work_authorization",
  "notes",
  "intake_source",
  "board_job_id",
  "created_at",
  "updated_at",
  "company:companies!job_postings_company_id_fkey(id,name)",
].join(",");

const PRIVATE_JOB_DETAIL_COLUMNS = [
  PRIVATE_JOB_COLUMNS,
  "extracted",
  "extraction_confidence",
].join(",");

const PRIVATE_JOB_MATCH_COLUMNS = [
  "id",
  "title",
  "location",
  "updated_at",
  "extracted",
  "company:companies!job_postings_company_id_fkey(name)",
].join(",");

type CompanyRelation = { id: string; name: string };

type PrivateJobRow = {
  id: string;
  title: string;
  role_type: string | null;
  location: string | null;
  term: string | null;
  work_mode: PrivateJobWorkMode | null;
  deadline: string | null;
  source_url: string | null;
  raw_text: string | null;
  match_score: number | null;
  status: PrivateJobStatus;
  coop_eligible: boolean;
  work_authorization: PrivateJobWorkAuthorization | null;
  notes: string | null;
  intake_source: PrivateJobIntakeSource;
  board_job_id: string | null;
  created_at: string;
  updated_at: string;
  company: CompanyRelation | CompanyRelation[] | null;
};

type PrivateJobDetailRow = PrivateJobRow & {
  extracted: unknown;
  extraction_confidence: number | null;
};

type PrivateJobMatchRow = {
  id: string;
  title: string;
  location: string | null;
  updated_at: string;
  extracted: unknown;
  company:
    | Pick<CompanyRelation, "name">
    | Pick<CompanyRelation, "name">[]
    | null;
};

export type PrivateJobMatchSource = {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  updatedAt: string;
  extracted: unknown;
};

function toPrivateJobMatchSource(
  row: PrivateJobMatchRow,
): PrivateJobMatchSource {
  const company = Array.isArray(row.company)
    ? row.company[0] ?? null
    : row.company;
  return {
    id: row.id,
    title: row.title,
    companyName: company?.name ?? null,
    location: row.location,
    updatedAt: row.updated_at,
    extracted: row.extracted,
  };
}

function companyRelation(
  relation: PrivateJobRow["company"],
): CompanyRelation | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

function toPrivateJob(row: PrivateJobRow): PrivateJob {
  const company = companyRelation(row.company);

  return {
    id: row.id,
    title: row.title,
    companyId: company?.id ?? null,
    companyName: company?.name ?? null,
    roleType: row.role_type,
    location: row.location,
    term: row.term,
    workMode: row.work_mode,
    deadline: row.deadline,
    sourceUrl: row.source_url,
    rawText: row.raw_text,
    matchScore: row.match_score,
    status: row.status,
    coopEligible: row.coop_eligible,
    workAuthorization: row.work_authorization,
    notes: row.notes,
    intakeSource: row.intake_source,
    boardJobId: row.board_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPrivateJobDetail(row: PrivateJobDetailRow): PrivateJobDetail {
  return {
    ...toPrivateJob(row),
    extracted: row.extracted,
    extractionConfidence: row.extraction_confidence,
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function getPrivateJobs(
  userId: string,
): Promise<PrivateJobsQueryResult<PrivateJob[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: [] };

  const { data, error } = await supabase
    .from("job_postings")
    .select(PRIVATE_JOB_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return { status: "error", data: [] };

  return {
    status: "ready",
    data: ((data ?? []) as unknown as PrivateJobRow[]).map(toPrivateJob),
  };
}

export async function getPrivateJobsForMatching(
  userId: string,
): Promise<PrivateJobsQueryResult<PrivateJobMatchSource[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: [] };

  const { data, error } = await supabase
    .from("job_postings")
    .select(PRIVATE_JOB_MATCH_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return { status: "error", data: [] };

  return {
    status: "ready",
    data: ((data ?? []) as unknown as PrivateJobMatchRow[]).map(
      toPrivateJobMatchSource,
    ),
  };
}

export async function getPrivateJobForWorkflow(
  userId: string,
  jobId: string,
): Promise<PrivateJobsQueryResult<PrivateJobMatchSource | null>> {
  if (!isUuid(jobId)) return { status: "ready", data: null };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: null };

  const { data, error } = await supabase
    .from("job_postings")
    .select(PRIVATE_JOB_MATCH_COLUMNS)
    .eq("user_id", userId)
    .eq("id", jobId)
    .maybeSingle();

  if (error) return { status: "error", data: null };
  return {
    status: "ready",
    data: data
      ? toPrivateJobMatchSource(data as unknown as PrivateJobMatchRow)
      : null,
  };
}

export async function getPrivateJob(
  userId: string,
  jobId: string,
): Promise<PrivateJobsQueryResult<PrivateJobDetail | null>> {
  if (!isUuid(jobId)) return { status: "ready", data: null };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: null };

  const { data, error } = await supabase
    .from("job_postings")
    .select(PRIVATE_JOB_DETAIL_COLUMNS)
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { status: "error", data: null };

  return {
    status: "ready",
    data: data ? toPrivateJobDetail(data as unknown as PrivateJobDetailRow) : null,
  };
}

export async function getPrivateJobByBoardId(
  userId: string,
  boardJobId: string,
): Promise<PrivateJobsQueryResult<Pick<PrivateJob, "id"> | null>> {
  if (!isUuid(boardJobId)) return { status: "ready", data: null };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", data: null };

  const { data, error } = await supabase
    .from("job_postings")
    .select("id")
    .eq("user_id", userId)
    .eq("board_job_id", boardJobId)
    .maybeSingle();

  if (error) return { status: "error", data: null };
  return { status: "ready", data: data ? { id: data.id } : null };
}
