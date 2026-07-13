import { createSupabaseServerClient } from "@/lib/supabase/server";

export const BOARD_SUBMISSION_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "archived",
] as const;

export type BoardSubmissionStatus =
  (typeof BOARD_SUBMISSION_STATUSES)[number];

export type OwnBoardSubmission = {
  id: string;
  title: string;
  companyName: string;
  submittedAt: string;
  sourceUrl: string;
  status: BoardSubmissionStatus;
};

export type OwnBoardSubmissionsResult =
  | { status: "ready"; data: OwnBoardSubmission[] }
  | { status: "error"; data: [] };

type OwnBoardSubmissionRow = {
  id: string;
  title: string;
  company_name: string;
  created_at: string;
  submitted_url: string | null;
  source_url: string;
  status: BoardSubmissionStatus;
};

export const BOARD_SUBMISSION_STATUS_LABELS: Record<
  BoardSubmissionStatus,
  string
> = {
  pending_review: "Pending review",
  approved: "On the board",
  rejected: "Not added",
  archived: "Archived",
};

export async function getOwnBoardSubmissions(
  userId: string,
): Promise<OwnBoardSubmissionsResult> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) return { status: "error", data: [] };

  const { data, error } = await supabase
    .from("board_jobs")
    .select(
      "id,title,company_name,created_at,submitted_url,source_url,status",
    )
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });

  if (error) return { status: "error", data: [] };

  return {
    status: "ready",
    data: ((data ?? []) as unknown as OwnBoardSubmissionRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      companyName: row.company_name,
      submittedAt: row.created_at,
      sourceUrl: row.submitted_url ?? row.source_url,
      status: row.status,
    })),
  };
}
