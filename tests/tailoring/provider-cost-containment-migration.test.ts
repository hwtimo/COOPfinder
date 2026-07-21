import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720220000_contain_live_provider_costs.sql",
  "utf8",
);
const parserCreditMigration = readFileSync(
  "supabase/migrations/202607130016_atomic_parser_analysis_credits.sql",
  "utf8",
);

test("future signup grants append exactly one credit without rewriting history", () => {
  const grant = migration.match(
    /create or replace function public\.grant_signup_credits\(\)[\s\S]*?comment on function/,
  )?.[0];
  assert.ok(grant);
  assert.match(grant, /insert into public\.tailoring_credit_ledger/);
  assert.match(grant, /new\.user_id,\s*1,\s*'signup_grant'/);
  assert.match(grant, /on conflict do nothing/);
  assert.doesNotMatch(grant, /update|delete from public\.tailoring_credit_ledger/i);
});

test("public signup copy consistently advertises one free credit", () => {
  for (const file of [
    "app/login/page.tsx",
    "components/start/start-onboarding.tsx",
    "lib/auth/paths.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /1 free tailoring credit/);
    assert.doesNotMatch(source, /2 free tailoring credits/);
  }
});

test("tailoring attempts are rolling, refund-independent, idempotent, and concurrent-safe", () => {
  const reserve = migration.match(
    /create or replace function public\.reserve_tailoring_generation_credit[\s\S]*?comment on function/,
  )?.[0];
  assert.ok(reserve);
  assert.match(reserve, /pg_advisory_xact_lock/);
  assert.match(reserve, /idempotency_key = p_idempotency_key[\s\S]*?if found then/);
  assert.match(
    reserve,
    /created_at >= pg_catalog\.statement_timestamp\(\) - interval '24 hours'/,
  );
  assert.match(reserve, /if v_attempt_count >= 2 then/);
  assert.match(reserve, /'rate_limited'/);
  assert.doesNotMatch(
    reserve.match(/select pg_catalog\.count\(\*\)[\s\S]*?if v_attempt_count/)?.[0] ?? "",
    /reservation\.state\s*(?:=|in)/,
  );
});

test("trusted function boundary and existing storage contracts remain restricted", () => {
  assert.match(migration, /security definer\s*set search_path = ''/g);
  assert.match(
    migration,
    /revoke all on function public\.reserve_tailoring_generation_credit\(uuid, uuid, text, text, text\) from authenticated/,
  );
  assert.doesNotMatch(migration, /raw_text|prompt|generated_content|profile prose/i);
  assert.doesNotMatch(migration, /create table|alter table|parser_analysis/i);
});

test("the existing parser policy already bounds refunded provider attempts", () => {
  assert.match(parserCreditMigration, /pg_advisory_xact_lock/);
  assert.match(
    parserCreditMigration,
    /created_at >= pg_catalog\.statement_timestamp\(\) - interval '24 hours'/,
  );
  assert.match(parserCreditMigration, /if v_attempt_count >= 3 then/);
  assert.match(parserCreditMigration, /'daily_limit'/);
  const attemptQuery = parserCreditMigration.match(
    /select pg_catalog\.count\(\*\)::integer\s+into v_attempt_count[\s\S]*?if v_attempt_count/,
  )?.[0];
  assert.ok(attemptQuery);
  assert.doesNotMatch(attemptQuery, /reservation\.state\s*(?:=|in)/);
});
