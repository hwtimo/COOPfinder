import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720205747_finalize_tailored_resume_documents_v2.sql",
  "utf8",
);

test("migration admits matched v1/v2 reservation contracts and preserves locking and owner scope", () => {
  assert.match(migration, /tailoring-provider-input-v1[\s\S]*tailoring-plan-output-v1/);
  assert.match(migration, /tailoring-provider-input-v2[\s\S]*tailoring-plan-output-v2/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /job\.user_id = v_user_id/);
  assert.match(migration, /reservation\.user_id = v_user_id/);
  assert.match(migration, /v_balance - v_active_holds < 1/);
});

test("v2 finalizer validates before one version, one debit, and one consumed transition", () => {
  const body = migration.match(/create function public\.finalize_tailored_resume_document\([\s\S]*?\n\$\$;/)?.[0];
  assert.ok(body);
  assert.match(body, /is_valid_tailored_resume_version_content_v2/);
  assert.equal((body.match(/insert into public\.resume_versions/g) ?? []).length, 1);
  assert.equal((body.match(/insert into public\.tailoring_credit_ledger/g) ?? []).length, 1);
  assert.equal((body.match(/set state = 'consumed'/g) ?? []).length, 1);
  assert.match(body, /amount, reason, ref[\s\S]*-1, 'tailor_generation'/);
  assert.match(body, /when 'consumed'[\s\S]*already_completed[\s\S]*return;/);
  assert.ok(body.indexOf("when 'consumed'") < body.indexOf("is_valid_tailored_resume_version_content_v2"));
});

test("strict envelope omits unsafe artifacts and requires document/source lineage", () => {
  assert.match(migration, /tailored-resume-version-content-v2/);
  assert.match(migration, /tailored-resume-document-v1/);
  assert.match(migration, /v_selected -> 'fragments' <> v_document_fragments/);
  assert.match(migration, /v_selected -> 'evidence' <> v_document_evidence/);
  assert.match(migration, /v_plan_fragment_refs <> v_document_fragment_refs/);
  assert.match(migration, /v_plan_evidence_refs <> v_document_evidence_refs/);
  assert.doesNotMatch(migration, /professionalSummary|prompt|instructions|diagnostics|providerInput\b|raw_text|extracted/);
});

test("browser and anonymous finalization remain denied and obsolete trusted v1 wrapper is removed", () => {
  assert.match(migration, /revoke all on function public\.finalize_tailored_resume_document\([^;]+ from authenticated;/);
  assert.match(migration, /revoke all on function public\.finalize_tailored_resume_document_trusted\([^;]+ from authenticated;/);
  assert.match(migration, /grant execute on function public\.finalize_tailored_resume_document_trusted\([^;]+ to service_role;/);
  assert.match(migration, /drop function public\.finalize_tailoring_generated_content_trusted/);
  assert.doesNotMatch(migration, /grant execute on function public\.finalize_tailored_resume_document(?:\(|_trusted\()[^;]+ to (?:anon|authenticated)/);
});
