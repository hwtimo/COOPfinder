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
    }), {
      status: "redirect",
      href: `/resumes/versions/${VERSION_ID}`,
    });
  }
});

test("pending, no-credit, preflight, and terminal failures use fixed safe copy", () => {
  assert.match(JSON.stringify(mapTailoringGenerationActionOutcome({ status: "generation_in_progress" })), /already in progress/);
  assert.match(JSON.stringify(mapTailoringGenerationActionOutcome({ status: "insufficient_credit" })), /enough tailoring credits/);
  assert.match(JSON.stringify(mapTailoringGenerationActionOutcome({ status: "insufficient_candidate_data" })), /approved bullets/);
  const failed = mapTailoringGenerationActionOutcome({ status: "provider_unavailable" });
  assert.match(JSON.stringify(failed), /could not be generated/);
  assert.equal(failed.status === "state" && failed.state.retryable, true);
  assert.doesNotMatch(JSON.stringify(failed), /provider|SQL|fingerprint|reservation|service.role|stack/i);
});

test("unauthenticated and non-owned resources preserve auth and not-found outcomes", () => {
  assert.deepEqual(mapTailoringGenerationActionOutcome({ status: "unauthenticated" }), { status: "unauthenticated" });
  assert.deepEqual(mapTailoringGenerationActionOutcome({ status: "not_found" }), { status: "not_found" });
});

test("server action accepts only bound job and idempotency IDs before framework state", () => {
  const source = readFileSync("app/(app)/resumes/tailor/actions.ts", "utf8");
  assert.match(source, /^"use server";/);
  assert.match(source, /generateTailoredResumeAction\(\s*jobId: string,\s*idempotencyKey: string,\s*_previousState:/);
  assert.match(source, /generateOwnedTailoredResume\(jobId, idempotencyKey\)/);
  assert.doesNotMatch(source, /FormData|userId|reservationId|creditAmount|providerInput|resumeContent|fragment/i);
  assert.doesNotMatch(source, /\.rpc\(|createSupabaseAdminClient|OpenAI/);
});
