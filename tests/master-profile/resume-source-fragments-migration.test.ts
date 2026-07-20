import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720201240_add_resume_source_fragments.sql",
  "utf8",
);
const action = readFileSync(
  "app/(app)/resumes/master/actions.ts",
  "utf8",
);
const query = readFileSync("lib/master-profile/queries.ts", "utf8");

test("migration adds one additive JSONB fragment column without a table or policy", () => {
  assert.match(
    migration,
    /alter table public\.master_profile_entries\s+add column resume_fragments jsonb not null default '\[\]'::jsonb/,
  );
  assert.equal((migration.match(/\badd column\b/gi) ?? []).length, 1);
  assert.doesNotMatch(migration, /\bcreate\s+table\b/i);
  assert.doesNotMatch(migration, /\bcreate\s+policy\b/i);
  assert.doesNotMatch(migration, /\bdisable\s+row\s+level\s+security\b/i);
});

test("SQL normalization strictly validates, bounds, normalizes, and orders fragments", () => {
  for (const key of [
    "fragmentId",
    "text",
    "evidenceTags",
    "confirmed",
    "order",
    "provenance",
  ]) {
    assert.equal(migration.includes(`'${key}'`), true);
  }
  assert.match(migration, /jsonb_object_keys\(v_fragment\)/);
  assert.match(migration, /jsonb_array_length\(p_fragments\) > 20/);
  assert.match(migration, /char_length\(v_text\) not between 1 and 500/);
  assert.match(migration, /jsonb_array_length\(v_fragment->'evidenceTags'\) > 20/);
  assert.match(migration, /char_length\(v_tag_text\) > 80/);
  assert.match(migration, /regexp_replace/);
  assert.match(migration, /lower\(v_tag_text\)/);
  assert.match(migration, /jsonb_agg\(item\.value order by \(item\.value->>'order'\)::integer\)/);
});

test("save RPC signature, authentication, ownership scope, and atomic return contract remain", () => {
  assert.match(
    migration,
    /create function public\.save_master_profile\(\s*p_profile jsonb,\s*p_skills jsonb,\s*p_entries jsonb\s*\) returns table\(saved_entries integer\)/,
  );
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /where entry\.user_id = v_user_id/);
  assert.match(migration, /return query select v_saved_entries/);
});

test("old-client omission preserves exact existing fragments and explicit arrays can clear", () => {
  assert.match(migration, /if v_entry \? 'resumeFragments' then/);
  assert.match(
    migration,
    /existing\.value->'resumeFragments'[\s\S]*existing\.value->>'section' = v_entry->>'section'[\s\S]*existing\.value->>'source'[\s\S]*existing\.value->>'text'/,
  );
  assert.match(migration, /coalesce\(v_fragments, '\[\]'::jsonb\)/);
  assert.match(
    migration,
    /set resume_fragments = v_fragments[\s\S]*entry\.master_profile_id = v_master_profile_id/,
  );
});

test("internal helpers are closed and only the public save RPC is granted", () => {
  for (const role of ["public", "anon", "authenticated", "service_role"]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.normalize_resume_source_fragments\\(jsonb\\) from ${role}`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.save_master_profile_without_resume_fragments\\(jsonb, jsonb, jsonb\\) from ${role}`,
      ),
    );
  }
  assert.match(
    migration,
    /grant execute on function public\.save_master_profile\(jsonb, jsonb, jsonb\) to authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.save_master_profile\(jsonb, jsonb, jsonb\) to (anon|service_role|public)/,
  );
});

test("application save and load paths round-trip fragment presence without exposing errors", () => {
  assert.match(action, /resumeFragments: entry\.resumeFragments/);
  assert.match(query, /resume_fragments/);
  assert.match(query, /parseResumeSourceFragments/);
  assert.doesNotMatch(action, /error\?\.details|error\?\.hint|stack/i);
});

test("guest import stays unchanged and fragment-free", () => {
  const guestImport = readFileSync(
    "supabase/migrations/202607130005_fix_import_guest_draft_hash_ambiguity.sql",
    "utf8",
  );
  assert.doesNotMatch(guestImport, /resume_fragments|resumeFragments/);
  assert.match(
    guestImport,
    /insert into public\.master_profile_entries \([\s\S]*entry_text, skills, confirmed, sort_order/,
  );
});
