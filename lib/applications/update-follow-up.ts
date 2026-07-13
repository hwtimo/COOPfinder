import type { SupabaseClient } from "@supabase/supabase-js";

const ISO_TIMESTAMP_WITH_ZONE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;

type FollowUpRpcRow = {
  result_status: unknown;
  application_id: unknown;
  application_follow_up_due: unknown;
};

export type UpdateApplicationFollowUpResult =
  | {
      status: "updated" | "unchanged";
      applicationId: string;
      followUpDue: string | null;
    }
  | { status: "unavailable" }
  | { status: "unexpected"; errorCode?: string };

export function isIsoTimestampWithTimezone(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = ISO_TIMESTAMP_WITH_ZONE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? "").padEnd(3, "0").slice(0, 3));

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return false;
  }

  const wallTime = new Date(0);
  wallTime.setUTCFullYear(year, month - 1, day);
  wallTime.setUTCHours(hour, minute, second, millisecond);

  if (
    wallTime.getUTCFullYear() !== year ||
    wallTime.getUTCMonth() !== month - 1 ||
    wallTime.getUTCDate() !== day ||
    wallTime.getUTCHours() !== hour ||
    wallTime.getUTCMinutes() !== minute ||
    wallTime.getUTCSeconds() !== second
  ) {
    return false;
  }

  if (match[8] !== "Z") {
    const offsetHour = Number(match[10]);
    const offsetMinute = Number(match[11]);
    if (
      offsetHour > 14 ||
      offsetMinute > 59 ||
      (offsetHour === 14 && offsetMinute !== 0)
    ) {
      return false;
    }

    const offsetDirection = match[9] === "+" ? 1 : -1;
    const instant =
      wallTime.getTime() -
      offsetDirection * (offsetHour * 60 + offsetMinute) * 60_000;
    if (!Number.isFinite(instant)) return false;
  }

  return true;
}

export async function updateApplicationFollowUp(
  supabase: SupabaseClient,
  applicationId: string,
  followUpDue: string | null,
): Promise<UpdateApplicationFollowUpResult> {
  const { data, error } = await supabase.rpc("update_application_follow_up", {
    p_application_id: applicationId,
    p_follow_up_due: followUpDue,
  });

  if (error) return { status: "unexpected", errorCode: error.code };

  const row = (Array.isArray(data) ? data[0] : data) as FollowUpRpcRow | null;
  if (
    row?.result_status === "unavailable" &&
    row.application_id === null &&
    row.application_follow_up_due === null
  ) {
    return { status: "unavailable" };
  }

  if (
    (row?.result_status === "updated" || row?.result_status === "unchanged") &&
    typeof row.application_id === "string" &&
    (row.application_follow_up_due === null ||
      isIsoTimestampWithTimezone(row.application_follow_up_due))
  ) {
    return {
      status: row.result_status,
      applicationId: row.application_id,
      followUpDue: row.application_follow_up_due,
    };
  }

  return { status: "unexpected" };
}
