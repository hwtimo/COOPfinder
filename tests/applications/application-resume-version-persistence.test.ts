import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createApplicationFromJob } from "../../lib/applications/create-from-job";

const JOB_ID = "c71a0000-0000-4000-8000-000000000001";
const RESUME_VERSION_ID = "b71a0000-0000-4000-8000-000000000001";
const APPLICATION_ID = "a71a0000-0000-4000-8000-000000000001";
const MIGRATION =
  "supabase/migrations/20260729182516_link_application_resume_version.sql";

function migrationSource() {
  return readFileSync(MIGRATION, "utf8");
}

test("application creation passes an optional resume version without changing the RPC", async () => {
  for (const resumeVersionId of [undefined, RESUME_VERSION_ID]) {
    let rpcCalls = 0;
    const supabase = {
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls += 1;
        assert.equal(name, "create_application_from_job");
        assert.deepEqual(args, {
          p_job_posting_id: JOB_ID,
          p_resume_version_id: resumeVersionId ?? null,
        });
        return {
          data: {
            result_status: "created",
            application_id: APPLICATION_ID,
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    assert.deepEqual(
      await createApplicationFromJob(supabase, JOB_ID, resumeVersionId),
      { status: "created", applicationId: APPLICATION_ID },
    );
    assert.equal(rpcCalls, 1);
  }
});

test("migration links only an owned resume version for the same owned job", () => {
  const source = migrationSource();

  assert.match(source, /add column resume_version_id uuid/i);
  assert.match(source, /unique \(id, user_id, job_posting_id\)/i);
  assert.match(
    source,
    /foreign key \(resume_version_id, user_id, job_posting_id\)[\s\S]*references public\.resume_versions\(id, user_id, job_posting_id\)/i,
  );
  assert.match(source, /on delete set null \(resume_version_id\)/i);
  assert.match(
    source,
    /version\.id = p_resume_version_id[\s\S]*version\.user_id = v_user_id[\s\S]*version\.job_posting_id = p_job_posting_id/i,
  );
});

test("migration preserves unlinked callers and rejects unavailable versions before writes", () => {
  const source = migrationSource();
  const versionValidation = source.indexOf(
    "if p_resume_version_id is not null and not exists",
  );
  const applicationInsert = source.indexOf("insert into public.applications");

  assert.match(source, /p_resume_version_id uuid default null/i);
  assert.ok(versionValidation >= 0);
  assert.ok(applicationInsert > versionValidation);
  assert.match(
    source.slice(versionValidation, applicationInsert),
    /return query select 'unavailable'::text, null::uuid/i,
  );
});

test("migration preserves one-application idempotency and the initial event atomically", () => {
  const source = migrationSource();
  const advisoryLock = source.indexOf("pg_catalog.pg_advisory_xact_lock");
  const existingLookup = source.indexOf("select application.id", advisoryLock);
  const applicationInsert = source.indexOf(
    "insert into public.applications",
    existingLookup,
  );
  const eventInsert = source.indexOf(
    "insert into public.application_timeline_events",
    applicationInsert,
  );

  assert.ok(advisoryLock >= 0);
  assert.ok(existingLookup > advisoryLock);
  assert.ok(applicationInsert > existingLookup);
  assert.ok(eventInsert > applicationInsert);
  assert.equal(
    (source.match(/insert into public\.applications/gi) ?? []).length,
    1,
  );
  assert.equal(
    (source.match(/insert into public\.application_timeline_events/gi) ?? [])
      .length,
    1,
  );
  assert.match(source, /return query select 'already_exists'::text/i);
  assert.doesNotMatch(source, /\bcommit\b|\bexception\s+when\b/i);
});

test("migration keeps the trusted RPC boundary and does not add AI or credit paths", () => {
  const source = migrationSource();

  assert.match(source, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(source, /security definer[\s\S]*set search_path = ''/i);
  assert.match(
    source,
    /revoke all on function public\.create_application_from_job\(uuid, uuid\)[\s\S]*from public/i,
  );
  assert.match(
    source,
    /grant execute on function public\.create_application_from_job\(uuid, uuid\)[\s\S]*to authenticated, service_role/i,
  );
  assert.doesNotMatch(
    source,
    /openai|provider|credit|reservation|tailoring_credit_ledger/i,
  );
});
