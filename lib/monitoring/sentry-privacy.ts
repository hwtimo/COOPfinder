type MonitoringRuntime = "browser" | "edge" | "node";

type SentryFrame = {
  filename?: string;
  function?: string;
  module?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
};

type SentryExceptionValue = Readonly<{
  type?: string;
  stacktrace?: Readonly<{ frames?: readonly SentryFrame[] }>;
}>;

export type SentryEventLike = Readonly<{
  type?: string;
  event_id?: string;
  timestamp?: number;
  platform?: string;
  level?: string;
  release?: string;
  environment?: string;
  transaction?: string;
  tags?: Readonly<Record<string, unknown>>;
  exception?: Readonly<{ values?: readonly SentryExceptionValue[] }>;
}>;

const SAFE_TAGS = new Set(["route", "route_type", "runtime", "status"]);
const BLOCKED_INTEGRATIONS = new Set([
  "Breadcrumbs",
  "Console",
  "ConsoleLogs",
  "ContextLines",
  "ExtraErrorData",
  "Http",
  "LocalVariables",
  "OpenAI",
  "RequestData",
  "VercelAI",
]);

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_SEGMENT = /^(?:\d+|[0-9a-f]{20,})$/i;
const EMAIL_SEGMENT = /@|%40/i;
const SAFE_EXCEPTION_TYPE = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;

export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
};

function safeText(value: unknown, maximumLength: number) {
  return typeof value === "string" && value.length <= maximumLength
    ? value
    : undefined;
}

export function sanitizeMonitoringRoute(value: unknown) {
  if (typeof value !== "string") return "unknown";
  const pathname = value.split(/[?#]/u, 1)[0]?.trim();
  if (!pathname?.startsWith("/")) return "unknown";

  const sanitized = pathname
    .split("/")
    .map((segment) =>
      UUID_SEGMENT.test(segment) ||
      OPAQUE_SEGMENT.test(segment) ||
      EMAIL_SEGMENT.test(segment)
        ? "[id]"
        : segment,
    )
    .join("/");

  return sanitized.slice(0, 240) || "/";
}

function sanitizeStackFilename(value: unknown) {
  if (typeof value !== "string") return undefined;
  const withoutQuery = value.split(/[?#]/u, 1)[0]?.replaceAll("\\", "/");
  if (!withoutQuery) return undefined;

  for (const marker of ["/.next/", "/app/", "/components/", "/lib/"]) {
    const markerIndex = withoutQuery.lastIndexOf(marker);
    if (markerIndex >= 0) return withoutQuery.slice(markerIndex + 1, markerIndex + 241);
  }

  return withoutQuery.split("/").at(-1)?.slice(0, 240);
}

function sanitizeFrame(frame: SentryFrame): SentryFrame {
  const sanitized: SentryFrame = {};
  const filename = sanitizeStackFilename(frame.filename);
  const functionName = safeText(frame.function, 160);
  const moduleName = safeText(frame.module, 160);

  if (filename) sanitized.filename = filename;
  if (functionName) sanitized.function = functionName;
  if (moduleName) sanitized.module = moduleName;
  if (Number.isSafeInteger(frame.lineno) && Number(frame.lineno) > 0) {
    sanitized.lineno = Number(frame.lineno);
  }
  if (Number.isSafeInteger(frame.colno) && Number(frame.colno) > 0) {
    sanitized.colno = Number(frame.colno);
  }
  if (typeof frame.in_app === "boolean") sanitized.in_app = frame.in_app;

  return sanitized;
}

function sanitizeException(value: SentryExceptionValue): SentryExceptionValue {
  const type =
    typeof value.type === "string" && SAFE_EXCEPTION_TYPE.test(value.type)
      ? value.type
      : "Error";
  const frames = value.stacktrace?.frames
    ?.slice(-80)
    .map((frame) => sanitizeFrame(frame));

  return {
    type,
    stacktrace: frames?.length ? { frames } : undefined,
  };
}

function sanitizeTags(
  tags: SentryEventLike["tags"],
  runtime: MonitoringRuntime,
) {
  const sanitized: Record<string, string> = { runtime };

  for (const [key, value] of Object.entries(tags ?? {})) {
    if (!SAFE_TAGS.has(key)) continue;
    if (key === "route") {
      sanitized.route = sanitizeMonitoringRoute(value);
      continue;
    }
    if (key === "status") {
      const status = String(value);
      if (/^[1-5]\d{2}$/u.test(status)) sanitized.status = status;
      continue;
    }
    if (key === "runtime") continue;
    const text = safeText(value, 80);
    if (text && /^[A-Za-z0-9_.:/[\]-]+$/u.test(text)) sanitized[key] = text;
  }

  return sanitized;
}

export function scrubSentryEvent<T extends SentryEventLike>(
  event: T,
  runtime: MonitoringRuntime,
): T {
  const values = event.exception?.values?.slice(0, 8).map(sanitizeException);

  return {
    event_id: safeText(event.event_id, 64),
    timestamp:
      typeof event.timestamp === "number" && Number.isFinite(event.timestamp)
        ? event.timestamp
        : undefined,
    platform: safeText(event.platform, 40),
    level: safeText(event.level, 20),
    release: safeText(event.release, 120),
    environment: safeText(event.environment, 40),
    transaction: sanitizeMonitoringRoute(event.transaction),
    tags: sanitizeTags(event.tags, runtime),
    exception: values?.length ? { values } : undefined,
  } as unknown as T;
}

export function filterPrivacyUnsafeIntegrations<
  T extends Readonly<{ name: string }>,
>(integrations: readonly T[]) {
  return integrations.filter(
    (integration) => !BLOCKED_INTEGRATIONS.has(integration.name),
  );
}
