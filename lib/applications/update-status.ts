import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isApplicationTrackerStatus,
  type ApplicationTrackerStatus,
} from "./types";

type StatusRpcRow = {
  result_status: unknown;
  application_id: unknown;
  application_status: unknown;
  applied_at: unknown;
};

export type UpdateApplicationStatusResult =
  | {
      status: "updated" | "unchanged";
      applicationId: string;
      applicationStatus: ApplicationTrackerStatus;
      appliedAt: string | null;
    }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export async function updateApplicationStatus(
  supabase: SupabaseClient,
  applicationId: string,
  status: ApplicationTrackerStatus,
): Promise<UpdateApplicationStatusResult> {
  const { data, error } = await supabase.rpc("update_application_status", {
    p_application_id: applicationId,
    p_status: status,
  });

  if (error) return { status: "unexpected", errorCode: error.code };

  const row = (Array.isArray(data) ? data[0] : data) as StatusRpcRow | null;
  if (
    row?.result_status === "unavailable" &&
    row.application_id === null &&
    row.application_status === null
  ) {
    return { status: "unavailable" };
  }

  if (
    (row?.result_status === "updated" || row?.result_status === "unchanged") &&
    typeof row.application_id === "string" &&
    isApplicationTrackerStatus(row.application_status) &&
    (typeof row.applied_at === "string" || row.applied_at === null)
  ) {
    return {
      status: row.result_status,
      applicationId: row.application_id,
      applicationStatus: row.application_status,
      appliedAt: row.applied_at,
    };
  }

  return { status: "unexpected" };
}
