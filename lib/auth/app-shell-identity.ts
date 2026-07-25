export type AppShellUser = {
  name: string;
  email: string;
  initials: string;
  meta: string;
  context: string;
};

type AuthenticatedUserIdentity = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export type AppShellProfile = {
  full_name: string | null;
  school: string | null;
  program: string | null;
  coop_term: string | null;
};

function cleanLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function profileInitials(name: string, email: string): string {
  if (name === email) {
    return email.charAt(0).toUpperCase() || "A";
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || email.charAt(0).toUpperCase() || "A";
}

export function buildAppShellUser(
  user: AuthenticatedUserIdentity | null,
  profile: AppShellProfile | null,
): AppShellUser | null {
  if (!user) return null;

  const email = cleanLabel(user.email);
  const profileName = cleanLabel(profile?.full_name);
  const metadataName =
    cleanLabel(user.user_metadata?.full_name) ||
    cleanLabel(user.user_metadata?.name);
  const name = profileName || metadataName || email || "Account";
  const profileMeta = [profile?.school, profile?.program]
    .map(cleanLabel)
    .filter(Boolean)
    .join(" · ");

  return {
    name,
    email,
    initials: profileInitials(name, email),
    meta: profileMeta || email || "Account",
    context: cleanLabel(profile?.coop_term) || "Workspace",
  };
}
