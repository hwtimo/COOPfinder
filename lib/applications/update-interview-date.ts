import type { SupabaseClient } from "@supabase/supabase-js";

import { isIsoCalendarDate } from "./update-deadline";

type InterviewDateRpcRow = {
  result_status: unknown;
  application_id: unknown;
  application_interview_date: unknown;
};

export type UpdateApplicationInterviewDateResult =
  | {
      status: "updated" | "unchanged";
      applicationId: string;
      interviewDate: string | null;
    }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export async function updateApplicationInterviewDate(
  supabase: SupabaseClient,
  applicationId: string,
  interviewDate: string | null,
): Promise<UpdateApplicationInterviewDateResult> {
  const { data, error } = await supabase.rpc(
    "update_application_interview_date",
    {
      p_application_id: applicationId,
      p_interview_date: interviewDate,
    },
  );

  if (error) return { status: "unexpected", errorCode: error.code };

  const row = (Array.isArray(data) ? data[0] : data) as
    | InterviewDateRpcRow
    | null;
  if (
    row?.result_status === "unavailable" &&
    row.application_id === null &&
    row.application_interview_date === null
  ) {
    return { status: "unavailable" };
  }

  if (
    (row?.result_status === "updated" || row?.result_status === "unchanged") &&
    typeof row.application_id === "string" &&
    (row.application_interview_date === null ||
      isIsoCalendarDate(row.application_interview_date))
  ) {
    return {
      status: row.result_status,
      applicationId: row.application_id,
      interviewDate: row.application_interview_date,
    };
  }

  return { status: "unexpected" };
}
