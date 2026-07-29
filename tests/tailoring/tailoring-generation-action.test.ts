import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mapTailoringGenerationActionOutcome } from "../../lib/tailoring/tailoring-generation-action-state";

const VERSION_ID = "e71a0000-0000-4000-8000-000000000001";

test("new generation and completed replay redirect to their saved immutable version", () => {
  for (const status of ["generated", "already_completed"] as const) {
    assert.deepEqual(mapTailoringGenerationActionOutcome({
      status,
      resumeVersionId: VERSION_ID,
      versionName: "Developer - tailored v1",
      creditResult: "used",
    }), {
      status: "redirect",
      href: `/resumes/versions/${VERSION_ID}`,
    });
  }
});

test("pending, no-credit, preflight, and terminal failures use fixed safe copy", () => {
  assert.deepEqual(
    mapTailoringGenerationActionOutcome({
      status: "generation_in_progress",
      creditResult: "not_used",
    }),
    {
      status: "state",
      state: {
        status: "pending",
        message: "Already generating — this won’t use another credit.",
        creditMessage: "No tailoring credit was used.",
      },
    },
  );
  assert.match(JSON.stringify(mapTailoringGenerationActionOutcome({
    status: "insufficient_credit",
    creditResult: "not_used",
  })), /enough tailoring credits/);
  assert.match(
    JSON.stringify(mapTailoringGenerationActionOutcome({
      status: "rate_limited",
      creditResult: "not_used",
    })),
    /temporarily limited/,
  );
  assert.match(
    JSON.stringify(
      mapTailoringGenerationActionOutcome({
        status: "configuration_unavailable",
        creditResult: "refunded",
      }),
    ),
    /not available right now/,
  );
  assert.match(JSON.stringify(mapTailoringGenerationActionOutcome({
    status: "insufficient_candidate_data",
    creditResult: "not_used",
  })), /approved bullets/);
  const failed = mapTailoringGenerationActionOutcome({
    status: "provider_unavailable",
    creditResult: "refunded",
  });
  assert.match(JSON.stringify(failed), /could not be generated/);
  assert.match(JSON.stringify(failed), /credit was refunded/);
  assert.equal(failed.status === "state" && failed.state.retryable, true);
  assert.doesNotMatch(JSON.stringify(failed), /provider|SQL|fingerprint|reservation|service.role|stack/i);
});

test("unauthenticated and non-owned resources preserve auth and not-found outcomes", () => {
  assert.deepEqual(mapTailoringGenerationActionOutcome({
    status: "unauthenticated",
    creditResult: "not_used",
  }), { status: "unauthenticated" });
  assert.deepEqual(mapTailoringGenerationActionOutcome({
    status: "not_found",
    creditResult: "not_used",
  }), { status: "not_found" });
});

test("uncertain finalization never claims a refund", () => {
  const outcome = mapTailoringGenerationActionOutcome({
    status: "persistence_failed",
    creditResult: "refund_unavailable",
  });

  assert.equal(outcome.status, "state");
  assert.equal(
    outcome.status === "state" ? outcome.state.creditMessage : "",
    "Refund status is unavailable. Do not assume a refund.",
  );
  assert.doesNotMatch(JSON.stringify(outcome), /credit was refunded/i);
});

test("every user-facing typed failure includes a sanitized reason and explicit credit result", () => {
  const cases = [
    ["extraction_unavailable", "not_used"],
    ["profile_unavailable", "not_used"],
    ["invalid_extraction", "not_used"],
    ["insufficient_job_data", "not_used"],
    ["insufficient_candidate_data", "not_used"],
    ["insufficient_credit", "not_used"],
    ["rate_limited", "not_used"],
    ["generation_in_progress", "not_used"],
    ["attempt_terminal", "not_used"],
    ["configuration_unavailable", "refunded"],
    ["provider_unavailable", "refunded"],
    ["invalid_provider_output", "refunded"],
    ["persistence_failed", "refunded"],
    ["unavailable", "refund_unavailable"],
  ] as const;

  for (const [status, creditResult] of cases) {
    const outcome = mapTailoringGenerationActionOutcome({
      status,
      creditResult,
    });
    assert.equal(outcome.status, "state");
    if (outcome.status !== "state") continue;
    assert.ok(outcome.state.message.length > 0);
    assert.ok(outcome.state.creditMessage.length > 0);
    assert.doesNotMatch(
      JSON.stringify(outcome),
      /reservation.?id|provider detail|prompt|service.role|SQL|stack/i,
    );
  }
});

test("server action accepts only bound job and idempotency IDs before framework state", () => {
  const source = readFileSync("app/(app)/resumes/tailor/actions.ts", "utf8");
  assert.match(source, /^"use server";/);
  assert.match(source, /generateTailoredResumeAction\(\s*jobId: string,\s*idempotencyKey: string,\s*_previousState:/);
  assert.match(source, /generateOwnedTailoredResume\(jobId, idempotencyKey\)/);
  assert.doesNotMatch(source, /FormData|userId|reservationId|creditAmount|providerInput|resumeContent|fragment/i);
  assert.doesNotMatch(source, /\.rpc\(|createSupabaseAdminClient|OpenAI/);
});
