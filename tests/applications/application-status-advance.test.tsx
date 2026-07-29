import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";

import { ApplicationStatusAdvance } from "../../app/(app)/applications/[id]/application-status-advance";
import {
  APPLICATION_TRACKER_COLUMNS,
  getNextApplicationTrackerStatus,
  type ApplicationTrackerStatus,
} from "../../lib/applications/types";
import { updateApplicationStatus } from "../../lib/applications/update-status";

const APPLICATION_ID = "d71a0000-0000-4000-8000-000000000001";

const supportedProgression = [
  ["saved", "tailoring"],
  ["tailoring", "ready"],
  ["ready", "applied"],
  ["applied", "interview"],
  ["interview", "offer"],
] as const satisfies readonly (readonly [
  ApplicationTrackerStatus,
  ApplicationTrackerStatus,
])[];

test("defines the deterministic progression and keeps terminal states terminal", () => {
  assert.deepEqual(
    APPLICATION_TRACKER_COLUMNS.map((status) => status.id),
    [
      "saved",
      "tailoring",
      "ready",
      "applied",
      "interview",
      "offer",
      "rejected",
    ],
  );
  for (const [current, next] of supportedProgression) {
    assert.equal(getNextApplicationTrackerStatus(current), next);
  }
  assert.equal(getNextApplicationTrackerStatus("offer"), null);
  assert.equal(getNextApplicationTrackerStatus("rejected"), null);
});

test("each supported status calls the existing atomic RPC with its next status", async () => {
  for (const [current, next] of supportedProgression) {
    let rpcCalls = 0;
    const supabase = {
      async rpc(name: string, args: Record<string, unknown>) {
        rpcCalls += 1;
        assert.equal(name, "update_application_status");
        assert.deepEqual(args, {
          p_application_id: APPLICATION_ID,
          p_status: next,
        });
        return {
          data: {
            result_status: "updated",
            application_id: APPLICATION_ID,
            application_status: next,
            applied_at:
              next === "applied" ? "2026-07-29T20:00:00.000Z" : null,
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const result = await updateApplicationStatus(
      supabase,
      APPLICATION_ID,
      getNextApplicationTrackerStatus(current)!,
    );
    assert.equal(result.status, "updated");
    assert.equal(rpcCalls, 1);
  }
});

test("shows the next status before submission and hides terminal actions", () => {
  for (const [current, next] of supportedProgression) {
    const label = APPLICATION_TRACKER_COLUMNS.find(
      (status) => status.id === next,
    )?.label;
    const html = renderToStaticMarkup(
      <ApplicationStatusAdvance
        applicationId={APPLICATION_ID}
        currentStatus={current}
      />,
    );
    assert.match(html, /Next status/);
    assert.match(html, new RegExp(`Advance to ${label}`));
  }

  for (const terminal of ["offer", "rejected"] as const) {
    assert.equal(
      renderToStaticMarkup(
        <ApplicationStatusAdvance
          applicationId={APPLICATION_ID}
          currentStatus={terminal}
        />,
      ),
      "",
    );
  }
});

test("UI prevents duplicate in-flight calls and the action refreshes persisted detail", () => {
  const component = readFileSync(
    "app/(app)/applications/[id]/application-status-advance.tsx",
    "utf8",
  );
  const page = readFileSync("app/(app)/applications/[id]/page.tsx", "utf8");
  const action = readFileSync("app/(app)/applications/actions.ts", "utf8");

  assert.match(component, /if \(submittingRef\.current\) return/);
  assert.match(component, /disabled=\{pending\}/);
  assert.match(component, /updateApplicationStatusAction\(/);
  assert.match(page, /<ApplicationStatusAdvance/);
  assert.match(page, /<ApplicationStatusForm/);
  assert.match(action, /revalidatePath\(`\/applications\/\$\{applicationId\}`\)/);
  assert.match(action, /refresh\(\)/);
});

test("atomic RPC creates one event, no-ops duplicate targets, and scopes ownership", () => {
  const migration = readFileSync(
    "supabase/migrations/202607130009_atomic_application_status.sql",
    "utf8",
  );
  const unchanged = migration.indexOf("if v_previous_status = p_status then");
  const eventInsert = migration.indexOf(
    "insert into public.application_timeline_events",
  );

  assert.ok(unchanged >= 0);
  assert.ok(eventInsert > unchanged);
  assert.equal(
    migration.match(/insert into public\.application_timeline_events/g)
      ?.length,
    1,
  );
  assert.match(migration, /for update/);
  assert.match(migration, /application\.user_id = v_user_id/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(
    migration,
    /revoke all on function public\.update_application_status\(uuid, text\) from public/,
  );
  assert.match(
    migration,
    /grant execute on function public\.update_application_status\(uuid, text\) to authenticated/,
  );
});
