import { getIsoToday, isBoardJobUnexpired } from "./dates";
import type { BoardQueryResult, BoardWorkMode, PublicBoardJob } from "./types";
import { publicStarterJobs } from "@/lib/mock/board-jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PUBLIC_BOARD_COLUMNS = [
  "id",
  "title",
  "company_name",
  "location",
  "work_mode",
  "term",
  "deadline",
  "work_authorization",
  "summary",
  "required_skills",
  "nice_to_have_skills",
  "keywords",
  "source_url",
  "last_checked_at",
  "status",
  "is_active",
].join(",");

type BoardJobRow = {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  work_mode: BoardWorkMode | null;
  term: string | null;
  deadline: string | null;
  work_authorization: string | null;
  summary: string;
  required_skills: string[] | null;
  nice_to_have_skills: string[] | null;
  keywords: string[] | null;
  source_url: string;
  last_checked_at: string | null;
  status: "approved";
  is_active: true;
};

function normalizeSummary(summary: string): string {
  return summary.replace(/^In-house summary:\s*/i, "").trim();
}

function toPublicBoardJob(row: BoardJobRow): PublicBoardJob {
  return {
    id: row.id,
    title: row.title,
    companyName: row.company_name,
    location: row.location,
    workMode: row.work_mode,
    term: row.term,
    deadline: row.deadline,
    workAuthorization: row.work_authorization,
    summary: normalizeSummary(row.summary),
    requiredSkills: row.required_skills ?? [],
    niceToHaveSkills: row.nice_to_have_skills ?? [],
    keywords: row.keywords ?? [],
    sourceUrl: row.source_url,
    lastCheckedAt: row.last_checked_at,
    status: "approved",
    isActive: true,
  };
}

function publicFixtureJobs(today: string): PublicBoardJob[] {
  return publicStarterJobs
    .filter(
      (job) =>
        job.status === "approved" &&
        job.isActive &&
        isBoardJobUnexpired(job.deadline, today),
    )
    .map((job) => ({
      ...job,
      summary: normalizeSummary(job.summary),
    }));
}

export async function getPublicBoardJobs(): Promise<
  BoardQueryResult<PublicBoardJob[]>
> {
  const today = getIsoToday();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { status: "ready", source: "fixture", data: publicFixtureJobs(today) };
  }

  const { data, error } = await supabase
    .from("board_jobs")
    .select(PUBLIC_BOARD_COLUMNS)
    .eq("status", "approved")
    .eq("is_active", true)
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("company_name", { ascending: true });

  if (error) return { status: "error", data: [] };

  return {
    status: "ready",
    source: "supabase",
    data: ((data ?? []) as unknown as BoardJobRow[]).map(toPublicBoardJob),
  };
}

export async function getPublicBoardJob(
  id: string,
): Promise<BoardQueryResult<PublicBoardJob | null>> {
  const today = getIsoToday();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const job = publicFixtureJobs(today).find((item) => item.id === id) ?? null;
    return { status: "ready", source: "fixture", data: job };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return { status: "ready", source: "supabase", data: null };
  }

  const { data, error } = await supabase
    .from("board_jobs")
    .select(PUBLIC_BOARD_COLUMNS)
    .eq("id", id)
    .eq("status", "approved")
    .eq("is_active", true)
    .or(`deadline.is.null,deadline.gte.${today}`)
    .maybeSingle();

  if (error) return { status: "error", data: null };

  return {
    status: "ready",
    source: "supabase",
    data: data ? toPublicBoardJob(data as unknown as BoardJobRow) : null,
  };
}
