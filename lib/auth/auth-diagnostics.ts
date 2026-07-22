import "server-only";

export const AUTH_FAILURE_CATEGORIES = [
  "smtp_configuration",
  "smtp_authentication",
  "smtp_delivery",
  "rate_limit",
  "redirect_not_allowed",
  "email_provider_disabled",
  "invalid_request",
  "network",
  "unknown",
] as const;

export type AuthFailureCategory = (typeof AUTH_FAILURE_CATEGORIES)[number];
export type AuthOperation =
  | "email_sign_in"
  | "password_sign_in"
  | "password_sign_up"
  | "password_reset_request"
  | "password_update"
  | "google_sign_in"
  | "auth_callback";

export type AuthDiagnostic = Readonly<{
  operation: AuthOperation;
  category: AuthFailureCategory;
  code?: string;
  httpStatus?: number;
}>;

type AuthErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function errorShape(error: unknown): AuthErrorShape {
  return typeof error === "object" && error !== null
    ? (error as AuthErrorShape)
    : {};
}

function safeCode(error: unknown) {
  const code = errorShape(error).code;
  if (typeof code !== "string") return undefined;
  const normalized = code.trim().toLocaleLowerCase("en-CA");
  return /^[a-z0-9_]{1,80}$/.test(normalized) ? normalized : undefined;
}

function safeStatus(error: unknown) {
  const status = errorShape(error).status;
  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
    ? status
    : undefined;
}

function internalMessage(error: unknown) {
  const message = errorShape(error).message;
  return typeof message === "string"
    ? message.toLocaleLowerCase("en-CA")
    : "";
}

export function classifyAuthFailure(error: unknown): AuthFailureCategory {
  const code = safeCode(error);
  const status = safeStatus(error);
  const message = internalMessage(error);

  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429
  ) {
    return "rate_limit";
  }
  if (code === "email_provider_disabled") return "email_provider_disabled";
  if (
    message.includes("redirect") &&
    (message.includes("allow") || message.includes("not permitted"))
  ) {
    return "redirect_not_allowed";
  }
  if (
    message.includes("535") ||
    message.includes("smtp authentication") ||
    message.includes("authentication failed") ||
    message.includes("invalid login")
  ) {
    return "smtp_authentication";
  }
  if (
    message.includes("smtp") &&
    (message.includes("configuration") ||
      message.includes("not configured") ||
      message.includes("missing"))
  ) {
    return "smtp_configuration";
  }
  if (
    message.includes("gomail") ||
    message.includes("could not send email") ||
    message.includes("error sending confirmation email") ||
    message.includes("mail delivery")
  ) {
    return "smtp_delivery";
  }
  if (
    code === "request_timeout" ||
    (!status &&
      (message.includes("fetch failed") ||
        message.includes("network") ||
        message.includes("connection")))
  ) {
    return "network";
  }
  if (
    status === 400 ||
    status === 422 ||
    code === "validation_failed" ||
    code === "bad_json" ||
    code === "email_address_invalid" ||
    code === "email_address_not_authorized"
  ) {
    return "invalid_request";
  }
  return "unknown";
}

export function buildAuthDiagnostic(
  operation: AuthOperation,
  error: unknown,
): AuthDiagnostic {
  const code = safeCode(error);
  const httpStatus = safeStatus(error);
  return {
    operation,
    category: classifyAuthFailure(error),
    ...(code === undefined ? {} : { code }),
    ...(httpStatus === undefined ? {} : { httpStatus }),
  };
}

export function reportAuthFailure(operation: AuthOperation, error: unknown) {
  console.error(`[supabase-auth] ${JSON.stringify(buildAuthDiagnostic(operation, error))}`);
}
