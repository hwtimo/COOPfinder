export const PRIVATE_ROUTE_PREFIXES = [
  "/jobs",
  "/dashboard",
  "/applications",
  "/resumes",
  "/calendar",
  "/insights",
  "/documents",
  "/settings",
] as const;

const UNSAFE_REDIRECT_PREFIXES = ["/login", "/auth"];
export const CANONICAL_PRODUCTION_ORIGIN = "https://internshipbc.dev";

const LOGIN_REASONS = [
  "save_job",
  "submit_board_job",
  "tailor_resume",
  "add_job",
  "full_analysis",
  "extract_job",
  "save_progress",
] as const;

export type LoginReason = (typeof LOGIN_REASONS)[number];

export function sanitizeLoginReason(value: unknown): LoginReason | undefined {
  return typeof value === "string" &&
    (LOGIN_REASONS as readonly string[]).includes(value)
    ? (value as LoginReason)
    : undefined;
}

export function getFirstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function sanitizeNextPath(
  value: FormDataEntryValue | string | string[] | null | undefined,
  fallback = "/dashboard",
): string {
  const raw = Array.isArray(value)
    ? value[0]
    : typeof value === "string"
      ? value
      : null;

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;

  try {
    const url = new URL(raw, "https://coopfinder.local");

    if (url.origin !== "https://coopfinder.local") return fallback;

    const path = `${url.pathname}${url.search}${url.hash}`;

    if (
      UNSAFE_REDIRECT_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      )
    ) {
      return fallback;
    }

    return path;
  } catch {
    return fallback;
  }
}

export function resolveAuthOrigin(
  requestOrigin: string,
  environment = process.env.NODE_ENV,
): string {
  if (environment === "production") return CANONICAL_PRODUCTION_ORIGIN;

  try {
    const parsed = new URL(requestOrigin);
    const isLoopback =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (isLoopback && (parsed.protocol === "http:" || parsed.protocol === "https:")) {
      return parsed.origin;
    }
  } catch {
    // Fall through to the canonical origin.
  }

  return CANONICAL_PRODUCTION_ORIGIN;
}

export function buildAppUrl(
  requestOrigin: string,
  path: string,
  environment = process.env.NODE_ENV,
) {
  return new URL(sanitizeNextPath(path), resolveAuthOrigin(requestOrigin, environment));
}

export function buildAuthCallbackUrl(
  origin: string,
  next: string,
  reason?: string,
  environment = process.env.NODE_ENV,
) {
  const callback = new URL(
    "/auth/callback",
    resolveAuthOrigin(origin, environment),
  );

  callback.searchParams.set("next", sanitizeNextPath(next));
  const safeReason = sanitizeLoginReason(reason);
  if (safeReason) callback.searchParams.set("reason", safeReason);
  return callback.toString();
}

export function buildPasswordResetCallbackUrl(
  origin: string,
  next: string,
  environment = process.env.NODE_ENV,
) {
  const resetPath = new URL("/reset-password", "https://coopfinder.local");
  resetPath.searchParams.set("next", sanitizeNextPath(next));
  return buildAuthCallbackUrl(
    origin,
    `${resetPath.pathname}${resetPath.search}`,
    undefined,
    environment,
  );
}

export function getLoginHref(next: string, reason?: string): string {
  const params = new URLSearchParams({
    next: sanitizeNextPath(next),
  });

  const safeReason = sanitizeLoginReason(reason);
  if (safeReason) params.set("reason", safeReason);

  return `/login?${params.toString()}`;
}

export function getLoginReasonCopy(reason?: string): string {
  switch (reason) {
    case "save_job":
      return "Log in to save this job to your list and keep tracking it.";
    case "submit_board_job":
      return "Log in to suggest a role for the public board and keep the original posting in your private workspace.";
    case "tailor_resume":
      return "Log in to tailor this resume. New accounts include 1 free tailoring credit.";
    case "add_job":
      return "Log in to add your own postings and track every next action.";
    case "full_analysis":
      return "Log in to run the full AI analysis for this posting.";
    case "extract_job":
      return "Log in to keep this posting private and extract its requirements for your review.";
    case "save_progress":
      return "Log in to save your draft profile and continue in your co-op workspace.";
    default:
      return "Log in to save your progress and continue in your co-op workspace.";
  }
}
