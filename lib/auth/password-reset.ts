export type PasswordUpdateFailure = "same_password" | "reset_failed";

export function classifyPasswordUpdateFailure(
  error: unknown,
): PasswordUpdateFailure {
  if (typeof error !== "object" || error === null) return "reset_failed";

  const code = (error as { code?: unknown }).code;
  return code === "same_password" ? "same_password" : "reset_failed";
}

export function getPasswordResetErrorCopy(error?: string): string | null {
  switch (error) {
    case "password_requirements":
      return "Use a password between 8 and 128 characters.";
    case "password_mismatch":
      return "The passwords do not match.";
    case "same_password":
      return "Choose a different password.";
    case undefined:
      return null;
    default:
      return "This reset session is unavailable or expired. Request a new link.";
  }
}
