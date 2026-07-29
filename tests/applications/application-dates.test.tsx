import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";

import { ApplicationInterviewDateForm } from "../../app/(app)/applications/[id]/application-interview-date-form";
import { updateApplicationDeadline } from "../../lib/applications/update-deadline";
import { updateApplicationFollowUp } from "../../lib/applications/update-follow-up";
import { updateApplicationInterviewDate } from "../../lib/applications/update-interview-date";

const APPLICATION_ID = "d71a0000-0000-4000-8000-000000000001";

function rpcClient(
  expectedName: string,
  expectedParameter: string,
  responseKey: string,
) {
  const submitted: unknown[] = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, expectedName);
      submitted.push(args[expectedParameter]);
      return {
        data: {
          result_status: "updated",
          application_id: APPLICATION_ID,
          [responseKey]: args[expectedParameter],
        },
        error: null,
      };
    },
  } as unknown as SupabaseClient;
  return { client, submitted };
}

test("deadline supports set, change, and clear through the existing RPC", async () => {
  const { client, submitted } = rpcClient(
    "update_application_deadline",
    "p_deadline",
    "application_deadline",
  );
  for (const value of ["2026-08-01", "2026-08-02", null] as const) {
    assert.equal(
      (await updateApplicationDeadline(client, APPLICATION_ID, value)).status,
      "updated",
    );
  }
  assert.deepEqual(submitted, ["2026-08-01", "2026-08-02", null]);
});

test("interview date supports set, change, and clear through one RPC", async () => {
  const { client, submitted } = rpcClient(
    "update_application_interview_date",
    "p_interview_date",
    "application_interview_date",
  );
  for (const value of ["2026-08-03", "2026-08-04", null] as const) {
    assert.equal(
      (
        await updateApplicationInterviewDate(client, APPLICATION_ID, value)
      ).status,
      "updated",
    );
  }
  assert.deepEqual(submitted, ["2026-08-03", "2026-08-04", null]);
});

test("follow-up supports set, change, and clear through the existing RPC", async () => {
  const { client, submitted } = rpcClient(
    "update_application_follow_up",
    "p_follow_up_due",
    "application_follow_up_due",
  );
  for (const value of [
    "2026-08-05T18:00:00.000Z",
    "2026-08-05T19:00:00.000Z",
    null,
  ] as const) {
    assert.equal(
      (await updateApplicationFollowUp(client, APPLICATION_ID, value)).status,
      "updated",
    );
  }
  assert.deepEqual(submitted, [
    "2026-08-05T18:00:00.000Z",
    "2026-08-05T19:00:00.000Z",
    null,
  ]);
});

test("each atomic date RPC creates one minimal event only after its no-op check", () => {
  for (const file of [
    "supabase/migrations/202607130012_atomic_application_deadline.sql",
    "supabase/migrations/202607130013_atomic_application_follow_up.sql",
    "supabase/migrations/20260729191227_add_application_interview_date.sql",
  ]) {
    const migration = readFileSync(file, "utf8");
    const unchanged = migration.indexOf("is not distinct from");
    const eventInsert = migration.indexOf(
      "insert into public.application_timeline_events",
    );
    const metadataStart = migration.indexOf(
      "pg_catalog.jsonb_build_object(",
    );
    const metadataEnd = migration.indexOf("\n    )", metadataStart);
    const metadata = migration.slice(metadataStart, metadataEnd);

    assert.ok(unchanged >= 0);
    assert.ok(eventInsert > unchanged);
    assert.equal(
      migration.match(/insert into public\.application_timeline_events/g)
        ?.length,
      1,
    );
    assert.doesNotMatch(
      metadata,
      /notes|detail|email|user_id|job_text|profile|resume/i,
    );
  }
});

test("interview mutation derives ownership and exposes no anonymous execution", () => {
  const migration = readFileSync(
    "supabase/migrations/20260729191227_add_application_interview_date.sql",
    "utf8",
  );
  const action = readFileSync("app/(app)/applications/actions.ts", "utf8");

  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /application\.user_id = v_user_id/);
  assert.match(migration, /for update/);
  assert.match(
    migration,
    /revoke all on function public\.update_application_interview_date\(uuid, date\)\s+from public/,
  );
  assert.match(
    migration,
    /revoke all on function public\.update_application_interview_date\(uuid, date\)\s+from anon/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_application_interview_date\(uuid, date\)\s+to authenticated/,
  );
  assert.match(action, /updateApplicationInterviewDateAction/);
  assert.match(action, /await supabase\.auth\.getUser\(\)/);
});

test("Application Detail reloads all persisted dates and keeps existing controls", () => {
  const query = readFileSync("lib/applications/queries.ts", "utf8");
  const page = readFileSync("app/(app)/applications/[id]/page.tsx", "utf8");

  assert.match(
    query,
    /notes,deadline,interview_date,follow_up_due,applied_at/,
  );
  assert.match(query, /interviewDate: application\.interview_date/);
  assert.match(page, /<ApplicationDeadlineForm/);
  assert.match(page, /<ApplicationInterviewDateForm/);
  assert.match(page, /<ApplicationFollowUpForm/);
  assert.match(page, /<ApplicationStatusAdvance/);
  assert.match(page, /<ApplicationStatusForm/);
  assert.match(page, /<ApplicationNotesForm/);
  assert.match(page, /<ApplicationDeleteControl/);
});

test("interview date is an accessible inline set/change/clear control", () => {
  const html = renderToStaticMarkup(
    <ApplicationInterviewDateForm
      applicationId={APPLICATION_ID}
      initialInterviewDate="2026-08-03"
    />,
  );
  const source = readFileSync(
    "app/(app)/applications/[id]/application-interview-date-form.tsx",
    "utf8",
  );

  assert.match(html, /for="application-interview-date"/);
  assert.match(html, /id="application-interview-date"/);
  assert.match(html, /type="date"/);
  assert.match(html, /value="2026-08-03"/);
  assert.match(html, />Clear</);
  assert.match(html, /Save interview/);
  assert.match(source, /if \(submittingRef\.current\) return/);
  assert.match(source, /disabled=\{pending\}/);
});
