import type { SupabaseClient } from "@supabase/supabase-js";

type CreationRpcRow = {
  result_status: unknown;
  application_id: unknown;
};

export type CreateApplicationFromJobResult =
  | { status: "created" | "already_exists"; applicationId: string }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export async function createApplicationFromJob(
  supabase: SupabaseClient,
  jobPostingId: string,
): Promise<CreateApplicationFromJobResult> {
  const { data, error } = await supabase.rpc("create_application_from_job", {
    p_job_posting_id: jobPostingId,
  });

  if (error) {
    return { status: "unexpected", errorCode: error.code };
  }

  const row = (Array.isArray(data) ? data[0] : data) as CreationRpcRow | null;
  if (row?.result_status === "unavailable" && row.application_id === null) {
    return { status: "unavailable" };
  }

  if (
    (row?.result_status === "created" ||
      row?.result_status === "already_exists") &&
    typeof row.application_id === "string"
  ) {
    return {
      status: row.result_status,
      applicationId: row.application_id,
    };
  }

  return { status: "unexpected" };
}
