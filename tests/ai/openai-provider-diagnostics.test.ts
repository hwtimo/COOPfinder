import assert from "node:assert/strict";
import test from "node:test";

import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "openai";

import {
  buildOpenAIProviderDiagnostic,
  classifyOpenAIProviderFailure,
} from "../../lib/ai/openai-provider-diagnostics";

const PRIVATE_MARKER = "PRIVATE_PROVIDER_MESSAGE_OR_CONTENT";

function apiError(
  status: number,
  code?: string,
  requestId = "req_safe_123",
) {
  return APIError.generate(
    status,
    {
      error: {
        code,
        message: PRIVATE_MARKER,
        raw_response: PRIVATE_MARKER,
      },
    },
    PRIVATE_MARKER,
    new Headers({
      authorization: `Bearer ${PRIVATE_MARKER}`,
      "x-request-id": requestId,
      "x-private-header": PRIVATE_MARKER,
    }),
  );
}

test("classifies installed OpenAI SDK failures into fixed safe categories", () => {
  const cases: ReadonlyArray<readonly [unknown, string]> = [
    [new APIConnectionTimeoutError({ message: PRIVATE_MARKER }), "timeout"],
    [apiError(401), "authentication"],
    [apiError(403), "permission"],
    [apiError(429), "rate_limit"],
    [apiError(429, "insufficient_quota"), "insufficient_quota"],
    [apiError(400, "invalid_request_error"), "invalid_request"],
    [apiError(404, "model_not_found"), "model_unavailable"],
    [apiError(500), "provider_server_error"],
    [
      new APIConnectionError({
        message: PRIVATE_MARKER,
        cause: new Error(PRIVATE_MARKER),
      }),
      "network",
    ],
    [new Error(PRIVATE_MARKER), "unknown"],
  ];

  for (const [error, expected] of cases) {
    assert.equal(classifyOpenAIProviderFailure(error), expected);
  }
});

test("diagnostics contain only adapter, category, safe status, and safe request ID", () => {
  const diagnostic = buildOpenAIProviderDiagnostic(
    "job_extraction",
    apiError(429, "insufficient_quota"),
  );
  assert.deepEqual(diagnostic, {
    adapter: "job_extraction",
    category: "insufficient_quota",
    httpStatus: 429,
    providerRequestId: "req_safe_123",
  });

  const serialized = JSON.stringify(diagnostic);
  assert.doesNotMatch(serialized, new RegExp(PRIVATE_MARKER));
  assert.doesNotMatch(serialized, /authorization|headers|message|body|error|prompt|input|output/i);
});

test("unsafe request IDs and arbitrary thrown data are discarded", () => {
  const unsafeRequestId = buildOpenAIProviderDiagnostic(
    "tailoring_generation",
    apiError(500, undefined, `req_${PRIVATE_MARKER}/forged`),
  );
  const arbitrary = buildOpenAIProviderDiagnostic("job_extraction", {
    message: PRIVATE_MARKER,
    apiKey: PRIVATE_MARKER,
    prompt: PRIVATE_MARKER,
    jobText: PRIVATE_MARKER,
    profile: PRIVATE_MARKER,
    output: PRIVATE_MARKER,
  });

  assert.deepEqual(unsafeRequestId, {
    adapter: "tailoring_generation",
    category: "provider_server_error",
    httpStatus: 500,
  });
  assert.deepEqual(arbitrary, {
    adapter: "job_extraction",
    category: "unknown",
  });
  assert.doesNotMatch(
    JSON.stringify({ unsafeRequestId, arbitrary }),
    new RegExp(PRIVATE_MARKER),
  );
});
