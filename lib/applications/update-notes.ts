import type { SupabaseClient } from "@supabase/supabase-js";

export const APPLICATION_NOTES_MAX_LENGTH = 5000;

type NotesRpcRow = {
  result_status: unknown;
  application_id: unknown;
  application_notes: unknown;
};

export type UpdateApplicationNotesResult =
  | {
      status: "updated" | "unchanged";
      applicationId: string;
      notes: string | null;
    }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export async function updateApplicationNotes(
  supabase: SupabaseClient,
  applicationId: string,
  notes: string,
): Promise<UpdateApplicationNotesResult> {
  const { data, error } = await supabase.rpc("update_application_notes", {
    p_application_id: applicationId,
    p_notes: notes,
  });

  if (error) return { status: "unexpected", errorCode: error.code };

  const row = (Array.isArray(data) ? data[0] : data) as NotesRpcRow | null;
  if (
    row?.result_status === "unavailable" &&
    row.application_id === null &&
    row.application_notes === null
  ) {
    return { status: "unavailable" };
  }

  if (
    (row?.result_status === "updated" || row?.result_status === "unchanged") &&
    typeof row.application_id === "string" &&
    (typeof row.application_notes === "string" ||
      row.application_notes === null)
  ) {
    return {
      status: row.result_status,
      applicationId: row.application_id,
      notes: row.application_notes,
    };
  }

  return { status: "unexpected" };
}
