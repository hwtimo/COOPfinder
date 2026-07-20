import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260719033047_extend_master_profile_candidate_evidence.sql",
  "utf8",
);

test("migration preserves the save RPC signature, owner context, and return contract", () => {
  assert.match(
    migration,
    /create or replace function public\.save_master_profile\(\s*p_profile jsonb,\s*p_skills jsonb,\s*p_entries jsonb\s*\) returns table\(saved_entries integer\)/,
  );
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /return query select v_saved_entries/);
});

test("migration strictly validates and normalizes all candidate evidence fields", () => {
  for (const field of [
    "candidateEvidence",
    "technologies",
    "softSkills",
    "certifications",
    "languages",
    "language",
    "proficiency",
  ]) {
    assert.equal(migration.includes(`'${field}'`), true);
  }
  assert.match(migration, /jsonb_object_keys\(v_candidate\)/);
  assert.match(migration, /jsonb_object_keys\(v_candidate_item\)/);
  assert.match(migration, /regexp_replace/);
  assert.match(migration, /v_seen_candidate_keys/);
});

test("old callers preserve evidence while explicit evidence updates only its JSONB path", () => {
  assert.match(migration, /when p_profile \? 'candidateEvidence' then/);
  assert.match(migration, /'\{candidateEvidence\}'/);
  assert.match(migration, /public\.master_profiles\.data/);
  assert.match(migration, /'\{skills\}'/);
});

test("migration preserves entry replacement and function privileges", () => {
  assert.match(migration, /delete from public\.master_profile_entries/);
  assert.match(migration, /where user_id = v_user_id and master_profile_id = v_master_profile_id/);
  assert.match(
    migration,
    /revoke all on function public\.save_master_profile\(jsonb, jsonb, jsonb\) from public/,
  );
  assert.match(
    migration,
    /revoke all on function public\.save_master_profile\(jsonb, jsonb, jsonb\) from anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.save_master_profile\(jsonb, jsonb, jsonb\) to authenticated/,
  );
});

test("migration adds no table, column, policy, or privilege", () => {
  assert.doesNotMatch(migration, /\bcreate\s+table\b/i);
  assert.doesNotMatch(migration, /\balter\s+table\b/i);
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i);
  assert.equal((migration.match(/create or replace function/gi) ?? []).length, 1);
  assert.equal((migration.match(/grant execute/gi) ?? []).length, 1);
});

test("guest import continues to preserve unrelated Master Profile JSONB paths", () => {
  const guestImport = readFileSync(
    "supabase/migrations/202607130005_fix_import_guest_draft_hash_ambiguity.sql",
    "utf8",
  );
  assert.match(
    guestImport,
    /set data = pg_catalog\.jsonb_set\(data, '\{skills\}', pg_catalog\.to_jsonb\(v_merged\), true\)/,
  );
  assert.doesNotMatch(guestImport, /candidateEvidence/);
});
