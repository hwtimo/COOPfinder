import type { SupabaseClient } from "@supabase/supabase-js";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DeadlineRpcRow = {
  result_status: unknown;
  application_id: unknown;
  application_deadline: unknown;
};

export type UpdateApplicationDeadlineResult =
  | {
      status: "updated" | "unchanged";
      applicationId: string;
      deadline: string | null;
    }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export function isIsoCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

export async function updateApplicationDeadline(
  supabase: SupabaseClient,
  applicationId: string,
  deadline: string | null,
): Promise<UpdateApplicationDeadlineResult> {
  const { data, error } = await supabase.rpc("update_application_deadline", {
    p_application_id: applicationId,
    p_deadline: deadline,
  });

  if (error) return { status: "unexpected", errorCode: error.code };

  const row = (Array.isArray(data) ? data[0] : data) as DeadlineRpcRow | null;
  if (
    row?.result_status === "unavailable" &&
    row.application_id === null &&
    row.application_deadline === null
  ) {
    return { status: "unavailable" };
  }

  if (
    (row?.result_status === "updated" || row?.result_status === "unchanged") &&
    typeof row.application_id === "string" &&
    (row.application_deadline === null ||
      isIsoCalendarDate(row.application_deadline))
  ) {
    return {
      status: row.result_status,
      applicationId: row.application_id,
      deadline: row.application_deadline,
    };
  }

  return { status: "unexpected" };
}
