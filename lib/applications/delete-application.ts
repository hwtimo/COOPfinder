import type { SupabaseClient } from "@supabase/supabase-js";

type DeletionRpcRow = {
  result_status: unknown;
  application_id: unknown;
};

export type DeleteApplicationResult =
  | { status: "deleted"; applicationId: string }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export async function deleteApplication(
  supabase: SupabaseClient,
  applicationId: string,
): Promise<DeleteApplicationResult> {
  const { data, error } = await supabase.rpc("delete_application", {
    p_application_id: applicationId,
  });

  if (error) return { status: "unexpected", errorCode: error.code };

  const row = (Array.isArray(data) ? data[0] : data) as DeletionRpcRow | null;
  if (row?.result_status === "unavailable" && row.application_id === null) {
    return { status: "unavailable" };
  }

  if (
    row?.result_status === "deleted" &&
    typeof row.application_id === "string"
  ) {
    return { status: "deleted", applicationId: row.application_id };
  }

  return { status: "unexpected" };
}
