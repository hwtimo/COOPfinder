import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260721164946_harden_public_function_execution_acl.sql",
  "utf8",
);
const boardAction = readFileSync(
  "app/(app)/board/submit/actions.ts",
  "utf8",
);
const originalCreditFunction = readFileSync(
  "supabase/migrations/202607090002_product_led_onboarding_delta.sql",
  "utf8",
);

const legacyBoardSignature =
  "submit_board_job\\(\\s*text, text, text, text, text, date, text, text\\s*\\)";
const privateBoardSignature =
  "submit_board_job_with_private_copy\\(\\s*text, text, text, text, text, text, date, text\\[\\], text, text\\s*\\)";

function assertRevokedFrom(signature: string, role: string) {
  assert.match(
    migration,
    new RegExp(
      `revoke all on function public\\.${signature} from ${role}`,
      "i",
    ),
  );
}

test("removes public and browser execution from the legacy board RPC", () => {
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assertRevokedFrom(legacyBoardSignature, role);
  }
  assert.doesNotMatch(
    migration,
    new RegExp(
      `grant execute on function public\\.${legacyBoardSignature}`,
      "i",
    ),
  );
});

test("keeps only authenticated execution for the current board submission RPC", () => {
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assertRevokedFrom(privateBoardSignature, role);
  }
  assert.match(
    migration,
    new RegExp(
      `grant execute on function public\\.${privateBoardSignature} to authenticated`,
      "i",
    ),
  );
  assert.match(boardAction, /\.rpc\(\s*"submit_board_job_with_private_copy"/);
  assert.doesNotMatch(boardAction, /\.rpc\(\s*"submit_board_job"/);
});

test("allows balance execution only for authenticated and service roles", () => {
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assertRevokedFrom("tailoring_credit_balance\\(uuid\\)", role);
  }
  assert.match(
    migration,
    /grant execute on function public\.tailoring_credit_balance\(uuid\)\s+to authenticated, service_role/i,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.tailoring_credit_balance\(uuid\)[\s\S]*?to (?:public|anon)/i,
  );
});

test("preserves the balance function owner/self isolation contract", () => {
  const definition = originalCreditFunction.match(
    /create or replace function public\.tailoring_credit_balance\(uid uuid\)[\s\S]*?\$\$;/,
  )?.[0];
  assert.ok(definition);
  assert.match(definition, /auth\.role\(\) = 'service_role'/);
  assert.match(definition, /auth\.uid\(\) = uid/);
  assert.doesNotMatch(migration, /create or replace function|create function/i);
});

test("changes no data, function body, RLS policy, or ledger table privilege", () => {
  assert.doesNotMatch(
    migration,
    /\b(?:insert|update|delete|create table|alter table|create policy|drop policy)\b/i,
  );
  assert.doesNotMatch(migration, /on table public\.tailoring_credit_ledger/i);
  assert.doesNotMatch(migration, /grant_signup_credits|signup_grant/i);
});
