export type TailoringReservationRpcResult =
  | Readonly<{
      status: "reserved" | "generation_in_progress";
      reservationId: string;
      expiresAt: string;
    }>
  | Readonly<{
      status: "already_completed";
      reservationId: string;
      resumeVersionId: string;
    }>
  | Readonly<{
      status: "terminal_refunded" | "terminal_expired";
      reservationId: string;
    }>
  | Readonly<{
      status: "insufficient_credit" | "not_found" | "invalid_input";
    }>
  | Readonly<{ status: "unavailable" }>;

export type TailoringRefundRpcResult =
  | Readonly<{
      status: "refunded" | "already_refunded" | "expired";
      reservationId: string;
    }>
  | Readonly<{
      status: "already_completed";
      reservationId: string;
      resumeVersionId: string;
    }>
  | Readonly<{ status: "not_found" | "invalid_input" }>
  | Readonly<{ status: "unavailable" }>;

export type TailoringFinalizationRpcResult =
  | Readonly<{
      status: "finalized" | "already_completed";
      reservationId: string;
      resumeVersionId: string;
      versionName: string;
    }>
  | Readonly<{
      status: "terminal_refunded" | "expired" | "invalid_output";
      reservationId: string;
    }>
  | Readonly<{ status: "not_found" | "invalid_input" }>
  | Readonly<{ status: "unavailable" }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function singleRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value)
    ? value.length === 1
      ? value[0]
      : null
    : value;
  return isRecord(row) ? row : null;
}

function hasExactKeys(
  row: Record<string, unknown>,
  expectedKeys: readonly string[],
) {
  const actual = Object.keys(row).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value))
  );
}

function isVersionName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value === value.replace(/\s+/g, " ").trim() &&
    value.length > 0 &&
    value.length <= 240
  );
}

export function parseTailoringReservationRpcResult(
  value: unknown,
): TailoringReservationRpcResult {
  const row = singleRow(value);
  if (
    !row ||
    !hasExactKeys(row, [
      "result_status",
      "reservation_id",
      "resume_version_id",
      "expires_at",
    ]) ||
    typeof row.result_status !== "string"
  ) {
    return { status: "unavailable" };
  }

  switch (row.result_status) {
    case "reserved":
    case "generation_in_progress":
      return isUuid(row.reservation_id) &&
        row.resume_version_id === null &&
        isTimestamp(row.expires_at)
        ? {
            status: row.result_status,
            reservationId: row.reservation_id,
            expiresAt: row.expires_at,
          }
        : { status: "unavailable" };
    case "already_completed":
      return isUuid(row.reservation_id) &&
        isUuid(row.resume_version_id) &&
        isTimestamp(row.expires_at)
        ? {
            status: "already_completed",
            reservationId: row.reservation_id,
            resumeVersionId: row.resume_version_id,
          }
        : { status: "unavailable" };
    case "terminal_refunded":
    case "terminal_expired":
      return isUuid(row.reservation_id) &&
        row.resume_version_id === null &&
        isTimestamp(row.expires_at)
        ? { status: row.result_status, reservationId: row.reservation_id }
        : { status: "unavailable" };
    case "insufficient_credit":
    case "not_found":
    case "invalid_input":
      return row.reservation_id === null &&
        row.resume_version_id === null &&
        row.expires_at === null
        ? { status: row.result_status }
        : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

export function parseTailoringRefundRpcResult(
  value: unknown,
): TailoringRefundRpcResult {
  const row = singleRow(value);
  if (
    !row ||
    !hasExactKeys(row, [
      "result_status",
      "reservation_id",
      "resume_version_id",
    ]) ||
    typeof row.result_status !== "string"
  ) {
    return { status: "unavailable" };
  }

  switch (row.result_status) {
    case "refunded":
    case "already_refunded":
    case "expired":
      return isUuid(row.reservation_id) && row.resume_version_id === null
        ? { status: row.result_status, reservationId: row.reservation_id }
        : { status: "unavailable" };
    case "already_completed":
      return isUuid(row.reservation_id) && isUuid(row.resume_version_id)
        ? {
            status: "already_completed",
            reservationId: row.reservation_id,
            resumeVersionId: row.resume_version_id,
          }
        : { status: "unavailable" };
    case "not_found":
    case "invalid_input":
      return row.reservation_id === null && row.resume_version_id === null
        ? { status: row.result_status }
        : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

export function parseTailoringFinalizationRpcResult(
  value: unknown,
): TailoringFinalizationRpcResult {
  const row = singleRow(value);
  if (
    !row ||
    !hasExactKeys(row, [
      "result_status",
      "reservation_id",
      "resume_version_id",
      "version_name",
    ]) ||
    typeof row.result_status !== "string"
  ) {
    return { status: "unavailable" };
  }

  switch (row.result_status) {
    case "finalized":
    case "already_completed":
      return isUuid(row.reservation_id) &&
        isUuid(row.resume_version_id) &&
        isVersionName(row.version_name)
        ? {
            status: row.result_status,
            reservationId: row.reservation_id,
            resumeVersionId: row.resume_version_id,
            versionName: row.version_name,
          }
        : { status: "unavailable" };
    case "terminal_refunded":
    case "expired":
    case "invalid_output":
      return isUuid(row.reservation_id) &&
        row.resume_version_id === null &&
        row.version_name === null
        ? { status: row.result_status, reservationId: row.reservation_id }
        : { status: "unavailable" };
    case "not_found":
      return row.reservation_id === null &&
        row.resume_version_id === null &&
        row.version_name === null
        ? { status: "not_found" }
        : { status: "unavailable" };
    case "invalid_input":
      return (row.reservation_id === null || isUuid(row.reservation_id)) &&
        row.resume_version_id === null &&
        row.version_name === null
        ? { status: "invalid_input" }
        : { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}
