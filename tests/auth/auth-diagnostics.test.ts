import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthDiagnostic,
  classifyAuthFailure,
  reportAuthFailure,
} from "../../lib/auth/auth-diagnostics";

test("classifies safe email-auth failure categories", () => {
  assert.equal(
    classifyAuthFailure({
      code: "unexpected_failure",
      status: 500,
      message: "gomail: could not send email 1: 550 delivery rejected",
    }),
    "smtp_delivery",
  );
  assert.equal(
    classifyAuthFailure({
      code: "over_email_send_rate_limit",
      status: 429,
    }),
    "rate_limit",
  );
  assert.equal(
    classifyAuthFailure({
      code: "email_provider_disabled",
      status: 400,
    }),
    "email_provider_disabled",
  );
  assert.equal(
    classifyAuthFailure({ status: 500, message: "SMTP authentication failed: 535" }),
    "smtp_authentication",
  );
  assert.equal(
    classifyAuthFailure({ status: 400, message: "redirect URL is not allowed" }),
    "redirect_not_allowed",
  );
  assert.equal(
    classifyAuthFailure({ message: "network connection failed" }),
    "network",
  );
});

test("diagnostics retain only validated code and status", () => {
  assert.deepEqual(
    buildAuthDiagnostic("email_sign_in", {
      code: "unexpected_failure",
      status: 500,
      message: "contains private@example.test and smtp-password",
      token: "secret-token",
    }),
    {
      operation: "email_sign_in",
      category: "unknown",
      code: "unexpected_failure",
      httpStatus: 500,
    },
  );
  assert.deepEqual(
    buildAuthDiagnostic("auth_callback", {
      code: "unsafe code with spaces",
      status: 200,
      message: "secret",
    }),
    { operation: "auth_callback", category: "unknown" },
  );
});

test("server log output redacts messages, emails, tokens, and arbitrary fields", () => {
  const original = console.error;
  const calls: string[] = [];
  console.error = (value?: unknown) => calls.push(String(value));
  try {
    reportAuthFailure("email_sign_in", {
      code: "unexpected_failure",
      status: 500,
      message: "gomail private@example.test smtp-password otp-123456",
      access_token: "access-secret",
    });
  } finally {
    console.error = original;
  }

  assert.equal(calls.length, 1);
  assert.match(calls[0], /"category":"smtp_delivery"/);
  assert.doesNotMatch(
    calls[0],
    /private@example|smtp-password|otp-123456|access-secret|message|access_token/,
  );
});
