import type { PrivateJobIntakeSource } from "./types";

export const PRIVATE_JOB_DESCRIPTION_MAX_LENGTH = 100_000;
export const MANUAL_JOB_DESCRIPTION_HEADING =
  "Paste the job description to continue";
export const MANUAL_JOB_DESCRIPTION_EXPLANATION =
  "Automatic URL retrieval is not currently supported. Paste the job description from the saved posting to make Analyze available.";

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
]);

const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "auth",
  "authorization",
  "password",
  "passwd",
  "secret",
  "session",
  "sessionid",
  "api_key",
  "apikey",
]);

export type JobUrlIntakeFailureStatus =
  | "invalid_url"
  | "unsupported_protocol"
  | "credentials_not_allowed"
  | "unsafe_host"
  | "unsupported_port"
  | "sensitive_query_not_allowed";

export type JobUrlNormalizationResult =
  | { status: "success"; normalizedUrl: string }
  | { status: JobUrlIntakeFailureStatus };

export type PreparedPrivateJobIntake =
  | {
      status: "success";
      sourceUrl: string | null;
      rawText: string | null;
      intakeSource: Extract<
        PrivateJobIntakeSource,
        "manual" | "pasted_text" | "pasted_url"
      >;
    }
  | { status: JobUrlIntakeFailureStatus };

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : Number.NaN,
  );

  return bytes.every((byte) => Number.isInteger(byte) && byte <= 255)
    ? bytes
    : null;
}

function isUnsafeIpv4(bytes: number[]): boolean {
  const [a, b] = bytes;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && bytes[2] === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && bytes[2] === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && bytes[2] === 100) ||
    (a === 203 && b === 0 && bytes[2] === 113) ||
    a >= 224
  );
}

function parseIpv6(hostname: string): number[] | null {
  const host = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (!host.includes(":")) return null;

  const halves = host.split("::");
  if (halves.length > 2) return null;

  const parseWords = (value: string) => {
    if (!value) return [];
    const words = value.split(":");
    if (words.some((word) => !/^[0-9a-f]{1,4}$/i.test(word))) return null;
    return words.map((word) => Number.parseInt(word, 16));
  };

  const left = parseWords(halves[0] ?? "");
  const right = parseWords(halves[1] ?? "");
  if (!left || !right) return null;

  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }

  const omitted = 8 - left.length - right.length;
  if (omitted < 1) return null;
  return [...left, ...Array<number>(omitted).fill(0), ...right];
}

function isUnsafeIpv6(words: number[]): boolean {
  const bytes = words.flatMap((word) => [word >> 8, word & 0xff]);
  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const ipv4Mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;
  const ipv4Compatible = bytes.slice(0, 12).every((byte) => byte === 0);

  return (
    allZero ||
    loopback ||
    (bytes[0] & 0xfe) === 0xfc ||
    (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) ||
    bytes[0] === 0xff ||
    (words[0] === 0x2001 && words[1] === 0x0db8) ||
    (ipv4Compatible && isUnsafeIpv4(bytes.slice(12))) ||
    (ipv4Mapped && isUnsafeIpv4(bytes.slice(12)))
  );
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  const ipv4 = parseIpv4(normalized);
  if (ipv4) return isUnsafeIpv4(ipv4);
  if (/^[\d.]+$/.test(normalized)) return true;

  if (normalized.startsWith("[") || normalized.includes(":")) {
    const ipv6 = parseIpv6(normalized);
    return !ipv6 || isUnsafeIpv6(ipv6);
  }

  return false;
}

export function normalizeJobUrl(value: string): JobUrlNormalizationResult {
  if (!value || value.length > 2_048) return { status: "invalid_url" };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { status: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { status: "unsupported_protocol" };
  }
  if (!url.hostname) return { status: "invalid_url" };
  if (url.username || url.password) {
    return { status: "credentials_not_allowed" };
  }
  if (isUnsafeHostname(url.hostname)) return { status: "unsafe_host" };
  if (url.port) return { status: "unsupported_port" };

  const retainedQuery = new URLSearchParams();
  for (const [key, queryValue] of url.searchParams) {
    const normalizedKey = key.toLowerCase().replace(/-/g, "_");
    if (SENSITIVE_QUERY_KEYS.has(normalizedKey)) {
      return { status: "sensitive_query_not_allowed" };
    }
    if (!TRACKING_QUERY_KEYS.has(normalizedKey)) {
      retainedQuery.append(key, queryValue);
    }
  }
  retainedQuery.sort();

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.search = retainedQuery.toString();

  return { status: "success", normalizedUrl: url.toString() };
}

export function preparePrivateJobIntake(input: {
  sourceUrl: string;
  rawText: string;
}): PreparedPrivateJobIntake {
  const rawText = input.rawText.trim();
  let sourceUrl: string | null = null;

  if (input.sourceUrl) {
    const normalized = normalizeJobUrl(input.sourceUrl);
    if (normalized.status !== "success") return normalized;
    sourceUrl = normalized.normalizedUrl;
  }

  return {
    status: "success",
    sourceUrl,
    rawText: rawText || null,
    intakeSource: rawText ? "pasted_text" : sourceUrl ? "pasted_url" : "manual",
  };
}

export function intakeSourceAfterManualEdit(
  currentSource: PrivateJobIntakeSource,
  rawText: string,
): PrivateJobIntakeSource {
  return currentSource === "pasted_url" && rawText.trim()
    ? "pasted_text"
    : currentSource;
}

export function requiresManualJobDescription(
  intakeSource: PrivateJobIntakeSource,
  rawText: string | null,
): boolean {
  return intakeSource === "pasted_url" && !rawText?.trim();
}

export function isPreparedForJobAnalysis(
  intakeSource: PrivateJobIntakeSource,
  rawText: string | null,
): boolean {
  return intakeSource === "pasted_text" && Boolean(rawText?.trim());
}

export function jobUrlFieldError(
  status: JobUrlIntakeFailureStatus,
): string {
  switch (status) {
    case "credentials_not_allowed":
      return "Remove the username or password from this URL.";
    case "unsafe_host":
      return "Enter a public job-posting URL.";
    case "unsupported_port":
      return "Use the standard http or https port.";
    case "sensitive_query_not_allowed":
      return "Remove sign-in or access information from this URL.";
    case "invalid_url":
    case "unsupported_protocol":
      return "Enter a valid http or https URL.";
  }
}
