import "server-only";

export function isGoogleAuthEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.GOOGLE_AUTH_ENABLED === "true";
}
