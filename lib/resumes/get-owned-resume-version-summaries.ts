import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOwnedResumeVersionSummaries } from "./resume-version-summaries";

import type {
  OwnedResumeVersionSummariesResult,
  ResumeVersionSummaryRow,
} from "./resume-version-summaries";

export async function getOwnedResumeVersionSummaries(
  userId: string,
): Promise<OwnedResumeVersionSummariesResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable", versions: [] };

  const { data, error } = await supabase
    .from("resume_versions")
    .select(
      "id,name,job_posting_id,created_at,job:job_postings!resume_versions_job_posting_id_fkey(title)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (error) return { status: "unavailable", versions: [] };

  return parseOwnedResumeVersionSummaries(
    (data ?? []) as unknown as ResumeVersionSummaryRow[],
  );
}
