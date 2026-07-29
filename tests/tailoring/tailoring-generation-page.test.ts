import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/(app)/resumes/tailor/[jobId]/page.tsx", "utf8");
const control = readFileSync("components/app/tailor/tailoring-generation-control.tsx", "utf8");

test("persisted UUID route shows preflight, available balance, exact cost, and Generate only when ready", () => {
  assert.match(route, /getOwnedTailoringPreflight\(jobId\)/);
  assert.match(route, /getCurrentTailoringCreditBalance\(\)/);
  assert.match(route, /<TailoringGenerationControl/);
  assert.match(route, /canGenerate=\{\s*result\.status === "ready" && result\.preflight\.readiness === "ready"/);
  assert.match(control, /Generation costs exactly 1 tailoring credit/);
  assert.match(control, /tailoring .*credits.* available/);
  assert.match(control, /Only approved Master Profile bullets and structured evidence/);
  assert.match(control, />\s*Generate tailored resume\s*</);
});

test("non-ready preflight hides Generate and legacy mock IDs fail closed", () => {
  const idGuard = route.indexOf("if (!isUuid(jobId)) notFound()");
  const productionBalance = route.indexOf("getCurrentTailoringCreditBalance()");
  assert.ok(idGuard >= 0 && productionBalance > idGuard);
  assert.doesNotMatch(route, /mockJobs|mockTailoringSessions|TailoringWorkspace/);
  assert.match(control, /\{canGenerate \? \(/);
  assert.match(control, /Generation becomes available when the tailoring preflight is ready/);
  assert.doesNotMatch(control, /mockJobs|TailoringWorkspace/);
});

test("pending submission is disabled and one key is reused until a terminal retry", () => {
  assert.match(control, /disabled=\{pending\}/);
  assert.match(control, /Already generating — this won’t use another credit\./);
  assert.match(control, /1\. Check the job, approved evidence, and tailoring credit\./);
  assert.match(control, /2\. Generate and validate the tailored resume\./);
  assert.match(control, /3\. Save the immutable version and finalize the credit\./);
  assert.match(control, /useRef\(initialIdempotencyKey\)/);
  assert.match(control, /const submitting = useRef\(false\)/);
  assert.match(control, /if \(submitting\.current\)/);
  assert.match(control, /generateTailoredResumeAction\(\s*jobId,\s*idempotencyKey\.current/);
  assert.match(control, /if \(nextState\.retryable\) idempotencyKey\.current = crypto\.randomUUID\(\)/);
  assert.match(route, /initialIdempotencyKey=\{randomUUID\(\)\}/);
  assert.doesNotMatch(control, />\s*Generating tailored resume\s*</);
});

test("browser UI performs no direct credit, reservation, finalization, or provider operation", () => {
  const source = `${route}\n${control}`;
  assert.doesNotMatch(source, /\.rpc\(|reserve_tailoring|refund_tailoring|finalize_tailored|tailoring_credit_ledger|createSupabaseAdminClient|OpenAI|responses\.parse/);
});
