import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729050747_add_user_edited_resume_versions.sql",
  "utf8",
);

test("adds parent lineage and explicit authorship without rewriting existing rows", () => {
  assert.match(
    migration,
    /add column parent_version_id uuid\s+references public\.resume_versions\(id\) on delete cascade/i,
  );
  assert.match(
    migration,
    /add column authorship text not null default 'ai_generated'/i,
  );
  assert.match(
    migration,
    /authorship in \('ai_generated', 'user_authored'\)/i,
  );
  assert.match(
    migration,
    /authorship = 'user_authored'[\s\S]*parent_version_id is not null/i,
  );
  assert.match(
    migration,
    /content ->> 'parentVersionId' = parent_version_id::text/i,
  );
  assert.doesNotMatch(migration, /\bupdate public\.resume_versions\b/i);
  assert.doesNotMatch(migration, /\bdelete from public\.resume_versions\b/i);
  assert.doesNotMatch(migration, /\binsert into public\.resume_versions\b/i);
});

test("removes browser write policies so all versions remain append-only", () => {
  for (const policy of [
    "resume_versions insert own",
    "resume_versions update own",
    "resume_versions delete own",
  ]) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists "${policy}"`, "i"),
    );
  }
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /grant .* to (?:public|anon|authenticated)/i);
  assert.doesNotMatch(migration, /security definer/i);
});
