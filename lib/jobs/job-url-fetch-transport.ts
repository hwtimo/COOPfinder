import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import http, {
  type IncomingHttpHeaders,
} from "node:http";
import https, { type RequestOptions } from "node:https";
import { isIP } from "node:net";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { normalizeJobUrl } from "./job-url-intake";

export const JOB_URL_FETCH_TIMEOUT_MS = 8_000;
export const JOB_URL_FETCH_MAX_RESPONSE_BYTES = 1024 * 1024;
export const JOB_URL_FETCH_MAX_TEXT_CHARACTERS = 100_000;

export type JobUrlFetchResult =
  | { status: "success"; text: string }
  | { status: "unauthenticated" }
  | { status: "job_unavailable" }
  | { status: "source_unavailable" }
  | { status: "blocked_url" }
  | { status: "redirect" }
  | { status: "timeout" }
  | { status: "oversized_body" }
  | { status: "unsupported_content" }
  | { status: "http_failure" }
  | { status: "empty_text" }
  | { status: "transport_unavailable" };

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

type OwnedSourceContext =
  | { status: "ready"; sourceUrl: string | null }
  | { status: "unauthenticated" }
  | { status: "job_unavailable" }
  | { status: "unavailable" };

type NetworkResponse =
  | {
      status: "response";
      statusCode: number;
      headers: IncomingHttpHeaders;
      body: Buffer;
    }
  | { status: "timeout" }
  | { status: "oversized_body" }
  | { status: "network_failure" };

export type JobUrlFetchTransportDependencies = {
  getOwnedSource: (jobId: string) => Promise<OwnedSourceContext>;
  resolveHostname: (hostname: string) => Promise<ResolvedAddress[]>;
  requestOnce: (
    url: URL,
    address: ResolvedAddress,
  ) => Promise<NetworkResponse>;
};

const PRIVATE_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map(Number);
  return bytes.every(
    (byte, index) =>
      Number.isInteger(byte) &&
      byte >= 0 &&
      byte <= 255 &&
      String(byte) === parts[index],
  )
    ? bytes
    : null;
}

function isPublicIpv4(address: string): boolean {
  const bytes = parseIpv4(address);
  if (!bytes) return false;
  const [a, b, c] = bytes;

  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandIpv6(address: string): number[] | null {
  const percentIndex = address.indexOf("%");
  const withoutZone =
    percentIndex === -1 ? address : address.slice(0, percentIndex);
  const mappedMatch = withoutZone.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let normalized = withoutZone;
  if (mappedMatch) {
    const ipv4 = parseIpv4(mappedMatch[2]);
    if (!ipv4) return null;
    normalized = `${mappedMatch[1]}${(
      (ipv4[0] << 8) |
      ipv4[1]
    ).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (value: string): number[] | null => {
    if (!value) return [];
    const words = value.split(":");
    if (words.some((word) => !/^[0-9a-f]{1,4}$/i.test(word))) return null;
    return words.map((word) => Number.parseInt(word, 16));
  };
  const left = parseHalf(halves[0] ?? "");
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const omitted = 8 - left.length - right.length;
  return omitted > 0
    ? [...left, ...Array<number>(omitted).fill(0), ...right]
    : null;
}

function isPublicIpv6(address: string): boolean {
  const words = expandIpv6(address);
  if (!words) return false;
  const bytes = words.flatMap((word) => [word >> 8, word & 0xff]);
  const ipv4Mapped =
    bytes.slice(0, 10).every((byte) => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff;

  if (ipv4Mapped) {
    return isPublicIpv4(bytes.slice(12).join("."));
  }

  const globallyRoutable = (words[0] & 0xe000) === 0x2000;
  const documentation =
    (words[0] === 0x2001 && words[1] === 0x0db8) ||
    (words[0] & 0xfff0) === 0x3ff0;
  const ietfSpecial = words[0] === 0x2001 && words[1] <= 0x01ff;
  const sixToFour = words[0] === 0x2002;

  return globallyRoutable && !documentation && !ietfSpecial && !sixToFour;
}

function isPublicAddress(resolved: ResolvedAddress): boolean {
  if (isIP(resolved.address) !== resolved.family) return false;
  return resolved.family === 4
    ? isPublicIpv4(resolved.address)
    : isPublicIpv6(resolved.address);
}

function normalizeReadableText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(
    /&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,
    (entity, encoded: string) => {
      if (encoded.startsWith("#")) {
        const hexadecimal = encoded[1]?.toLowerCase() === "x";
        const digits = encoded.slice(hexadecimal ? 2 : 1);
        const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
        if (
          !Number.isInteger(codePoint) ||
          codePoint < 0 ||
          codePoint > 0x10ffff
        ) {
          return entity;
        }
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }
      return named[encoded.toLowerCase()] ?? entity;
    },
  );
}

export function extractReadableJobText(
  body: Buffer,
  contentType: "text/html" | "text/plain",
): string {
  const decoded = body.toString("utf8");
  if (contentType === "text/plain") return normalizeReadableText(decoded);

  const withoutHiddenContent = decoded
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<(br|hr)\b[^>]*\/?>/gi, " ")
    .replace(/<\/(address|article|aside|blockquote|div|footer|h[1-6]|header|li|main|nav|ol|p|pre|section|table|td|th|tr|ul)>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return normalizeReadableText(decodeHtmlEntities(withoutHiddenContent));
}

function responseContentType(
  headers: IncomingHttpHeaders,
): "text/html" | "text/plain" | null {
  const contentEncoding = headers["content-encoding"];
  if (
    typeof contentEncoding === "string" &&
    contentEncoding.trim().toLowerCase() !== "identity"
  ) {
    return null;
  }
  const raw = headers["content-type"];
  if (typeof raw !== "string") return null;
  const mediaType = raw.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "text/plain"
    ? mediaType
    : null;
}

export function createJobUrlFetchTransport(
  dependencies: JobUrlFetchTransportDependencies,
): (jobId: string) => Promise<JobUrlFetchResult> {
  return async function fetchOwnedJobUrl(jobId) {
    if (!PRIVATE_JOB_ID_PATTERN.test(jobId)) {
      return { status: "job_unavailable" };
    }

    let context: OwnedSourceContext;
    try {
      context = await dependencies.getOwnedSource(jobId);
    } catch {
      return { status: "transport_unavailable" };
    }
    if (context.status !== "ready") {
      return {
        status:
          context.status === "unavailable"
            ? "transport_unavailable"
            : context.status,
      };
    }
    if (!context.sourceUrl) return { status: "source_unavailable" };

    const normalized = normalizeJobUrl(context.sourceUrl);
    if (normalized.status !== "success") return { status: "blocked_url" };
    const url = new URL(normalized.normalizedUrl);

    let addresses: ResolvedAddress[];
    try {
      addresses = await dependencies.resolveHostname(url.hostname);
    } catch {
      return { status: "blocked_url" };
    }
    if (
      addresses.length === 0 ||
      addresses.some((address) => !isPublicAddress(address))
    ) {
      return { status: "blocked_url" };
    }

    const address = [...addresses].sort(
      (left, right) =>
        left.family - right.family ||
        left.address.localeCompare(right.address, "en"),
    )[0];

    let response: NetworkResponse;
    try {
      response = await dependencies.requestOnce(url, address);
    } catch {
      return { status: "http_failure" };
    }
    if (response.status === "timeout") return { status: "timeout" };
    if (response.status === "oversized_body") {
      return { status: "oversized_body" };
    }
    if (response.status === "network_failure") {
      return { status: "http_failure" };
    }

    if (response.statusCode >= 300 && response.statusCode < 400) {
      return { status: "redirect" };
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return { status: "http_failure" };
    }

    const contentType = responseContentType(response.headers);
    if (!contentType) return { status: "unsupported_content" };
    const text = extractReadableJobText(response.body, contentType);
    if (!text) return { status: "empty_text" };
    if (text.length > JOB_URL_FETCH_MAX_TEXT_CHARACTERS) {
      return { status: "oversized_body" };
    }

    return { status: "success", text };
  };
}

async function getProductionOwnedSource(
  jobId: string,
): Promise<OwnedSourceContext> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" };

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { status: "unauthenticated" };

  const { data, error } = await supabase
    .from("job_postings")
    .select("source_url")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { status: "unavailable" };
  if (!data) return { status: "job_unavailable" };
  return { status: "ready", sourceUrl: data.source_url };
}

async function resolveProductionHostname(
  hostname: string,
): Promise<ResolvedAddress[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results
    .filter(
      (result): result is ResolvedAddress =>
        result.family === 4 || result.family === 6,
    )
    .map(({ address, family }) => ({ address, family }));
}

function requestProductionUrl(
  url: URL,
  resolved: ResolvedAddress,
): Promise<NetworkResponse> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NetworkResponse) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.protocol === "https:" ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Accept: "text/html, text/plain;q=0.9",
        "Accept-Encoding": "identity",
        "User-Agent": "InternshipBC-Job-URL-Transport/1.0",
      },
      lookup: (_hostname, _options, callback) => {
        callback(null, resolved.address, resolved.family);
      },
      servername: url.protocol === "https:" ? url.hostname : undefined,
    };
    const request = (url.protocol === "https:" ? https : http).request(
      options,
      (response) => {
        const declaredLength = Number(response.headers["content-length"]);
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > JOB_URL_FETCH_MAX_RESPONSE_BYTES
        ) {
          response.destroy();
          finish({ status: "oversized_body" });
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes > JOB_URL_FETCH_MAX_RESPONSE_BYTES) {
            response.destroy();
            finish({ status: "oversized_body" });
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          finish({
            status: "response",
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on("error", () => finish({ status: "network_failure" }));
      },
    );

    request.setTimeout(JOB_URL_FETCH_TIMEOUT_MS, () => {
      request.destroy();
      finish({ status: "timeout" });
    });
    request.on("error", () => finish({ status: "network_failure" }));
    request.end();
  });
}

const productionTransport = createJobUrlFetchTransport({
  getOwnedSource: getProductionOwnedSource,
  resolveHostname: resolveProductionHostname,
  requestOnce: requestProductionUrl,
});

export async function fetchOwnedJobSourceUrl(
  jobId: string,
): Promise<JobUrlFetchResult> {
  return productionTransport(jobId);
}
