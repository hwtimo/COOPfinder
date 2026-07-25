export type SettingsAccount = Readonly<{
  email: string | null;
  name: string | null;
  school: string | null;
  program: string | null;
  coopTerm: string | null;
}>;

type AuthenticatedAccount = Readonly<{
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}>;

export type SettingsProfileRow = Readonly<{
  full_name?: unknown;
  school?: unknown;
  program?: unknown;
  coop_term?: unknown;
}>;

function cleanLabel(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > maxLength) return null;

  return normalized;
}

export function buildSettingsAccount(
  user: AuthenticatedAccount,
  profile: SettingsProfileRow | null,
): SettingsAccount {
  const metadataName =
    cleanLabel(user.user_metadata?.full_name, 120) ??
    cleanLabel(user.user_metadata?.name, 120);

  return Object.freeze({
    email: cleanLabel(user.email, 320),
    name: cleanLabel(profile?.full_name, 120) ?? metadataName,
    school: cleanLabel(profile?.school, 120),
    program: cleanLabel(profile?.program, 120),
    coopTerm: cleanLabel(profile?.coop_term, 80),
  });
}
