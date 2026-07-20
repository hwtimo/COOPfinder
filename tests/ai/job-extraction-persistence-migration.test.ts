import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260718235941_extend_job_extraction_requirements.sql",
  "utf8",
);

const structuredCategories = [
  "requiredSkills",
  "preferredSkills",
  "requiredTechnologies",
  "preferredTechnologies",
  "education",
  "certifications",
  "languages",
  "workAuthorization",
  "experience",
  "responsibilities",
  "softSkills",
  "keywords",
  "uncategorizedRequirements",
] as const;

test("migration preserves the extraction RPC signature and owner scope", () => {
  assert.match(
    migration,
    /create or replace function public\.persist_job_extraction\(\s*p_job_posting_id uuid,\s*p_extracted jsonb,\s*p_overall_confidence numeric\s*\)/,
  );
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /job\.user_id = v_user_id/);
  assert.match(migration, /for update/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
});

test("migration keeps legacy payloads valid and validates every structured category", () => {
  assert.match(migration, /if p_extracted \? 'structuredRequirements' then/);
  for (const category of structuredCategories) {
    assert.equal(migration.includes(`'${category}'`), true);
  }
  assert.match(migration, /jsonb_typeof\(v_field_json\) is distinct from 'array'/);
  assert.match(migration, /jsonb_object_keys\(v_structured\)/);
});

test("migration preserves return states, confidence, event, and privileges", () => {
  for (const state of [
    "invalid_input",
    "unavailable",
    "unsupported_source",
    "unchanged",
    "updated",
  ]) {
    assert.equal(migration.includes(`'${state}'::text`), true);
  }
  assert.match(migration, /extraction_confidence = v_stored_confidence/);
  assert.match(migration, /insert into public\.job_intake_events/);
  assert.match(
    migration,
    /revoke all on function public\.persist_job_extraction\(uuid, jsonb, numeric\) from public/,
  );
  assert.match(
    migration,
    /revoke all on function public\.persist_job_extraction\(uuid, jsonb, numeric\) from anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.persist_job_extraction\(uuid, jsonb, numeric\) to authenticated/,
  );
});

test("migration introduces no table, column, or additional function", () => {
  assert.doesNotMatch(migration, /\bcreate\s+table\b/i);
  assert.doesNotMatch(migration, /\balter\s+table\b/i);
  assert.equal(
    (migration.match(/create or replace function/gi) ?? []).length,
    1,
  );
});
