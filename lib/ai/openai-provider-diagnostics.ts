import "server-only";

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";

export const OPENAI_PROVIDER_FAILURE_CATEGORIES = [
  "timeout",
  "authentication",
  "permission",
  "rate_limit",
  "insufficient_quota",
  "invalid_request",
  "model_unavailable",
  "provider_server_error",
  "network",
  "unknown",
] as const;

export type OpenAIProviderFailureCategory =
  (typeof OPENAI_PROVIDER_FAILURE_CATEGORIES)[number];

export type OpenAIProviderAdapterName =
  | "job_extraction"
  | "tailoring_generation";

export type OpenAIProviderDiagnostic = Readonly<{
  adapter: OpenAIProviderAdapterName;
  category: OpenAIProviderFailureCategory;
  httpStatus?: number;
  providerRequestId?: string;
}>;

function safeStatus(error: unknown) {
  if (!(error instanceof APIError)) return undefined;
  return typeof error.status === "number" &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 599
    ? error.status
    : undefined;
}

function safeRequestId(error: unknown) {
  if (!(error instanceof APIError) || typeof error.requestID !== "string") {
    return undefined;
  }
  const requestId = error.requestID.trim();
  return /^[A-Za-z0-9._:-]{1,200}$/.test(requestId)
    ? requestId
    : undefined;
}

function safeProviderCode(error: unknown) {
  return error instanceof APIError && typeof error.code === "string"
    ? error.code.toLocaleLowerCase("en-CA")
    : undefined;
}

export function classifyOpenAIProviderFailure(
  error: unknown,
): OpenAIProviderFailureCategory {
  if (error instanceof APIConnectionTimeoutError) return "timeout";
  if (error instanceof AuthenticationError) return "authentication";
  if (error instanceof PermissionDeniedError) return "permission";

  const status = safeStatus(error);
  const code = safeProviderCode(error);

  if (code === "insufficient_quota") return "insufficient_quota";
  if (code === "model_not_found" || code === "model_unavailable") {
    return "model_unavailable";
  }
  if (error instanceof RateLimitError || status === 429) return "rate_limit";
  if (status === 404) return "model_unavailable";
  if (
    error instanceof BadRequestError ||
    error instanceof UnprocessableEntityError ||
    status === 400 ||
    status === 409 ||
    status === 422
  ) {
    return "invalid_request";
  }
  if (error instanceof InternalServerError || (status && status >= 500)) {
    return "provider_server_error";
  }
  if (error instanceof APIConnectionError) return "network";
  return "unknown";
}

export function buildOpenAIProviderDiagnostic(
  adapter: OpenAIProviderAdapterName,
  error: unknown,
): OpenAIProviderDiagnostic {
  const httpStatus = safeStatus(error);
  const providerRequestId = safeRequestId(error);
  return {
    adapter,
    category: classifyOpenAIProviderFailure(error),
    ...(httpStatus === undefined ? {} : { httpStatus }),
    ...(providerRequestId === undefined ? {} : { providerRequestId }),
  };
}

export function reportOpenAIProviderDiagnostic(
  diagnostic: OpenAIProviderDiagnostic,
) {
  console.error(`[openai-provider] ${JSON.stringify(diagnostic)}`);
}
