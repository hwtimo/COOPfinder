import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720190758_persist_tailoring_generated_content.sql",
  "utf8",
);

test("strict SQL validation covers outer shape, versions, fingerprint, plan, and selected evidence", () => {
  assert.match(
    migration,
    /create function public\.is_valid_tailoring_generated_content_v1\(/,
  );
  assert.match(migration, /tailoring-generated-content-v1/);
  assert.match(migration, /tailoring-provider-input-v1/);
  assert.match(migration, /tailoring-plan-output-v1/);
  assert.match(migration, /\^\[0-9a-f\]\{64\}\$/);
  assert.match(migration, /public\.is_valid_tailoring_plan_output_v1/);
  assert.match(migration, /v_plan_ids <> v_selected_ids/);
  assert.match(migration, /\^ev_\[0-9\]\{3\}\$/);
  assert.match(migration, /sourceLabel/);
  assert.match(migration, /languageProficiency/);
  assert.match(migration, /jsonb_object_keys/);
});

test("new finalization stores one complete snapshot with unchanged atomic debit behavior", () => {
  const finalizer = migration.match(
    /create function public\.finalize_tailoring_generated_content\([\s\S]*?revoke all on function public\.finalize_tailoring_generated_content/,
  )?.[0];
  assert.ok(finalizer);
  assert.match(finalizer, /for update/);
  assert.match(finalizer, /pg_advisory_xact_lock/);
  assert.match(finalizer, /expire_tailoring_generation_reservations/);
  assert.match(finalizer, /insert into public\.resume_versions/);
  assert.match(finalizer, /p_generated_content, '\{\}'::jsonb/);
  assert.equal(
    (finalizer.match(/insert into public\.resume_versions/g) ?? []).length,
    1,
  );
  assert.equal(
    (finalizer.match(/insert into public\.tailoring_credit_ledger/g) ?? [])
      .length,
    1,
  );
  assert.equal(
    (finalizer.match(/update public\.tailoring_generation_reservations/g) ?? [])
      .length,
    1,
  );
});

test("obsolete plan-only trusted wrapper is removed and replacement is service-role only", () => {
  assert.match(
    migration,
    /revoke all on function public\.finalize_tailoring_generation_trusted[\s\S]*?from service_role/,
  );
  assert.match(
    migration,
    /drop function public\.finalize_tailoring_generation_trusted/,
  );
  assert.match(
    migration,
    /create function public\.finalize_tailoring_generated_content_trusted\(/,
  );
  assert.match(migration, /security definer\s+set search_path = ''/);
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.finalize_tailoring_generated_content_trusted[\\s\\S]*?from ${role}`,
      ),
    );
  }
  assert.match(
    migration,
    /grant execute on function public\.finalize_tailoring_generated_content_trusted[\s\S]*?to service_role/,
  );
});

test("migration changes no table, column, RLS policy, parser credit, or signup behavior", () => {
  assert.doesNotMatch(
    migration,
    /create table|alter table|drop table|create policy|drop policy/i,
  );
  assert.doesNotMatch(
    migration,
    /parser_analysis|signup_grant|grant_signup_credits/i,
  );
});
