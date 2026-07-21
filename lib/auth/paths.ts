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

export function buildAuthCallbackUrl(origin: string, next: string) {
  let safeOrigin = "http://localhost:3000";

  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      safeOrigin = parsed.origin;
    }
  } catch {
    // Keep the local fallback when request origin metadata is malformed.
  }

  const callback = new URL("/auth/callback", safeOrigin);
  callback.searchParams.set("next", sanitizeNextPath(next));
  return callback.toString();
}

export function getLoginHref(next: string, reason?: string): string {
  const params = new URLSearchParams({
    next: sanitizeNextPath(next),
  });

  if (reason) params.set("reason", reason);

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
