import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260720183952_harden_tailoring_generation_execution_boundary.sql",
  "utf8",
);
const reservationMigration = readFileSync(
  "supabase/migrations/20260720180155_tailoring_generation_reservations.sql",
  "utf8",
);

test("revokes every obsolete browser-callable lifecycle RPC", () => {
  for (const signature of [
    "reserve_tailoring_generation_credit\\(uuid, uuid, text, text, text\\)",
    "refund_tailoring_generation_reservation\\(uuid\\)",
    "finalize_tailoring_generation\\(uuid, text, text, text, jsonb\\)",
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature} from authenticated`),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature} from anon`),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`grant execute on function public\\.${signature} to authenticated`),
    );
  }
});

test("trusted wrappers accept an explicit server owner and grant only service role", () => {
  for (const name of [
    "reserve_tailoring_generation_credit_trusted",
    "refund_tailoring_generation_reservation_trusted",
    "finalize_tailoring_generation_trusted",
  ]) {
    assert.match(migration, new RegExp(`create function public\\.${name}\\(`));
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${name}[\\s\\S]*?from authenticated`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${name}[\\s\\S]*?to service_role`),
    );
  }
  assert.equal((migration.match(/p_user_id uuid/g) ?? []).length, 3);
  assert.equal((migration.match(/security definer/g) ?? []).length, 3);
  assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 3);
});

test("trusted wrappers bind the supplied owner to the proven lifecycle logic", () => {
  assert.equal((migration.match(/request\.jwt\.claims/g) ?? []).length, 3);
  assert.equal((migration.match(/'sub', p_user_id::text/g) ?? []).length, 3);
  assert.match(migration, /from public\.reserve_tailoring_generation_credit\(/);
  assert.match(migration, /from public\.refund_tailoring_generation_reservation\(/);
  assert.match(migration, /from public\.finalize_tailoring_generation\(/);
  assert.doesNotMatch(migration, /insert into|update public|delete from/i);
});

test("direct table writes remain denied while owner-only reads remain intact", () => {
  for (const table of [
    "tailoring_generation_reservations",
    "tailoring_generation_reservation_events",
  ]) {
    assert.match(
      reservationMigration,
      new RegExp(`revoke all on table public\\.${table} from authenticated`),
    );
    assert.match(
      reservationMigration,
      new RegExp(`grant select on table public\\.${table} to authenticated`),
    );
  }
  assert.match(
    reservationMigration,
    /using \(\(select auth\.uid\(\)\) = user_id\)/,
  );
});

test("hardening changes no table, column, RLS policy, parser credit, or signup behavior", () => {
  assert.doesNotMatch(migration, /create table|alter table|drop table|create policy|drop policy/i);
  assert.doesNotMatch(migration, /parser_analysis|signup_grant|grant_signup_credits/i);
});

test("the secret client is server-only and never exports credentials", () => {
  const source = readFileSync("lib/supabase/admin.ts", "utf8");
  assert.match(source, /^import "server-only";/);
  assert.match(source, /process\.env\.SUPABASE_SECRET_KEY/);
  assert.match(source, /persistSession: false/);
  assert.match(source, /autoRefreshToken: false/);
  assert.match(source, /detectSessionInUrl: false/);
  assert.doesNotMatch(
    source,
    /NEXT_PUBLIC_SUPABASE_SECRET|console\.|return \{[\s\S]*?secretKey/,
  );
});
