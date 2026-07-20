import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720180155_tailoring_generation_reservations.sql",
  "utf8",
);
const encodingFixMigration = readFileSync(
  "supabase/migrations/20260720180928_fix_tailoring_version_name_encoding.sql",
  "utf8",
);

test("creates only tailoring-specific reservation and append-only event tables", () => {
  assert.match(migration, /create table public\.tailoring_generation_reservations/);
  assert.match(
    migration,
    /create table public\.tailoring_generation_reservation_events/,
  );
  assert.equal((migration.match(/create table/gi) ?? []).length, 2);
  assert.doesNotMatch(migration, /alter table public\.parser_analysis/);
});

test("constrains owner, job, idempotency, contracts, state, and terminal timestamps", () => {
  assert.match(migration, /unique \(\s*user_id,\s*idempotency_key\s*\)/);
  assert.match(
    migration,
    /foreign key \(job_posting_id, user_id\)\s*references public\.job_postings\(id, user_id\)/,
  );
  assert.match(migration, /input_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /state in \('reserved', 'consumed', 'refunded', 'expired'\)/);
  assert.match(migration, /resume_version_id uuid unique references public\.resume_versions/);
  assert.match(migration, /tailoring-provider-input-v1/);
  assert.match(migration, /tailoring-plan-output-v1/);
  for (const timestamp of ["consumed_at", "refunded_at", "expired_at"]) {
    assert.equal(migration.includes(timestamp), true);
  }
});

test("uses one per-user lock and settled balance minus active unexpired holds", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /hashtextextended\(v_user_id::text, 0\)/);
  assert.match(migration, /sum\(ledger\.amount\)/);
  assert.match(migration, /v_balance - v_active_holds < 1/);
  assert.match(migration, /reservation\.expires_at > pg_catalog\.statement_timestamp\(\)/);
  assert.doesNotMatch(migration, /parser_analysis_credit_reservations[\s\S]*v_active_holds/);
});

test("reservation RPC derives ownership from auth uid and returns every safe state", () => {
  assert.match(
    migration,
    /create function public\.reserve_tailoring_generation_credit\(\s*p_job_posting_id uuid,\s*p_idempotency_key uuid,\s*p_input_fingerprint text,\s*p_provider_input_contract_version text,\s*p_provider_output_contract_version text/,
  );
  assert.doesNotMatch(migration, /reserve_tailoring_generation_credit\([\s\S]{0,200}p_user_id/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /job\.user_id = v_user_id/);
  for (const state of [
    "reserved",
    "already_completed",
    "generation_in_progress",
    "terminal_refunded",
    "terminal_expired",
    "insufficient_credit",
    "not_found",
    "invalid_input",
  ]) {
    assert.equal(migration.includes(`'${state}'::text`), true);
  }
});

test("expiration is fixed, lazy, terminal, and trigger-audited once", () => {
  assert.match(migration, /interval '10 minutes'/);
  assert.match(migration, /state = 'expired'/);
  assert.match(migration, /expired_at = pg_catalog\.statement_timestamp\(\)/);
  assert.match(
    migration,
    /tailoring_generation_reservation_events_terminal_idx[\s\S]*event_type in \('consumed', 'refunded', 'expired'\)/,
  );
  assert.equal((migration.match(/perform public\.expire_tailoring_generation_reservations/gi) ?? []).length, 3);
});

test("refund is idempotent and never creates a positive ledger entry", () => {
  for (const state of [
    "refunded",
    "already_refunded",
    "expired",
    "already_completed",
    "not_found",
  ]) {
    assert.equal(migration.includes(`'${state}'::text`), true);
  }
  const refundBody = migration.match(
    /create function public\.refund_tailoring_generation_reservation[\s\S]*?grant execute on function public\.refund_tailoring_generation_reservation\(uuid\) to authenticated;/,
  )?.[0];
  assert.ok(refundBody);
  assert.doesNotMatch(refundBody, /insert into public\.tailoring_credit_ledger/);
});

test("strict SQL plan validation rejects unknown prose fields and duplicate references", () => {
  assert.match(migration, /is_valid_tailoring_plan_output_v1/);
  for (const key of ["contractVersion", "summaryEvidenceIds", "sections", "type", "items", "evidenceId"]) {
    assert.equal(migration.includes(`'${key}'`), true);
  }
  assert.match(migration, /key_name not in \('contractVersion', 'summaryEvidenceIds', 'sections'\)/);
  assert.match(migration, /v_reference_id = any\(v_seen_references\)/);
  assert.match(migration, /v_section_type = any\(v_seen_sections\)/);
  assert.match(migration, /'\^ev_\[0-9\]\{3\}\$'/);
  assert.doesNotMatch(migration, /p_keyword_report|p_summary|p_bullet|p_employer/);
});

test("finalization atomically inserts one version, one debit, and consumes the locked reservation", () => {
  const finalization = migration.match(
    /create function public\.finalize_tailoring_generation[\s\S]*?grant execute on function public\.finalize_tailoring_generation\(uuid, text, text, text, jsonb\) to authenticated;/,
  )?.[0];
  assert.ok(finalization);
  assert.match(finalization, /for update/);
  assert.match(finalization, /insert into public\.resume_versions/);
  assert.match(finalization, /insert into public\.tailoring_credit_ledger/);
  assert.match(finalization, /-1,\s*'tailor_generation'/);
  assert.match(finalization, /state = 'consumed'/);
  assert.match(finalization, /resume_version_id = v_resume_version_id/);
  assert.match(finalization, /when 'consumed' then[\s\S]*'already_completed'::text/);
  assert.equal((finalization.match(/insert into public\.resume_versions/gi) ?? []).length, 1);
  assert.equal((finalization.match(/insert into public\.tailoring_credit_ledger/gi) ?? []).length, 1);
});

test("generation debits are exactly one and idempotent by reservation reference", () => {
  assert.match(
    migration,
    /create unique index tailoring_credit_ledger_generation_reservation_ref_idx[\s\S]*reason = 'tailor_generation'[\s\S]*ref like 'tailoring_generation_reservation:%'/,
  );
  assert.match(migration, /'tailoring_generation_reservation:' \|\| v_reservation\.id::text/);
  assert.doesNotMatch(migration, /amount[\s\S]{0,60}p_/);
});

test("version naming is owner-job scoped, monotonic, readable, and reservation-unique", () => {
  assert.match(migration, /reservation\.job_posting_id = v_reservation\.job_posting_id/);
  assert.match(migration, /reservation\.state = 'consumed'/);
  assert.match(migration, /tailored v%s/);
  assert.match(migration, /v_reservation\.id::text/);
  assert.doesNotMatch(migration, /p_version_name|p_job_title/);
  assert.match(migration, /'%s - tailored v%s - %s'/);
  assert.match(encodingFixMigration, /pg_get_functiondef/);
  assert.match(encodingFixMigration, /tailoring_generation_reservations/);
});

test("new tables expose owner select only and deny direct API writes", () => {
  for (const table of [
    "tailoring_generation_reservations",
    "tailoring_generation_reservation_events",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from authenticated`));
    assert.match(migration, new RegExp(`grant select on table public\\.${table} to authenticated`));
  }
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.doesNotMatch(migration, /for insert\s+to authenticated|for update\s+to authenticated|for delete\s+to authenticated/);
});

test("security-definer functions use empty search paths and minimum execution grants", () => {
  const securityDefiners = migration.match(/security definer/gi) ?? [];
  const emptySearchPaths = migration.match(/set search_path = ''/gi) ?? [];
  assert.equal(securityDefiners.length, 5);
  assert.equal(emptySearchPaths.length, 6);
  for (const signature of [
    "reserve_tailoring_generation_credit\\(uuid, uuid, text, text, text\\)",
    "refund_tailoring_generation_reservation\\(uuid\\)",
    "finalize_tailoring_generation\\(uuid, text, text, text, jsonb\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from anon`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to authenticated`));
  }
});

test("does not change parser credits, signup grants, existing policies, routes, or providers", () => {
  assert.doesNotMatch(migration, /alter table public\.parser_|drop table public\.parser_|create or replace function public\.reserve_parser/);
  assert.doesNotMatch(migration, /grant_signup_credits|profiles_grant_signup_credits|signup_grant/);
  assert.doesNotMatch(migration, /drop policy|alter policy/);
  assert.doesNotMatch(migration, /openai|provider prompt|fetch\(/i);
});
