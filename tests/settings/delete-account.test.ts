import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACCOUNT_DELETE_CONFIRMATION,
  deleteCurrentAccount,
  type DeleteCurrentAccountDependencies,
} from "../../lib/account/delete-current-account";

function dependencies(overrides: Partial<DeleteCurrentAccountDependencies> = {}) {
  const calls: string[] = [];
  const defaults: DeleteCurrentAccountDependencies = {
    getAuthenticatedUser: async () => { calls.push("authenticate"); return { id: "owner-a" }; },
    removeOwnedStorageObjects: async (id) => { calls.push(`storage:${id}`); return true; },
    deleteAuthUser: async (id) => { calls.push(`auth-delete:${id}`); return true; },
    clearSession: async () => { calls.push("sign-out"); return true; },
  };
  return { calls, value: { ...defaults, ...overrides } satisfies DeleteCurrentAccountDependencies };
}

test("requires exact confirmation before authentication", async () => {
  const context = dependencies();
  assert.deepEqual(await deleteCurrentAccount("delete", context.value), { status: "invalid_confirmation" });
  assert.deepEqual(context.calls, []);
});

test("rejects anonymous requests before the admin boundary", async () => {
  const context = dependencies({ getAuthenticatedUser: async () => { context.calls.push("authenticate"); return null; } });
  assert.deepEqual(await deleteCurrentAccount(ACCOUNT_DELETE_CONFIRMATION, context.value), { status: "unauthenticated" });
  assert.deepEqual(context.calls, ["authenticate"]);
});

test("derives the target from authentication and preserves deletion order", async () => {
  const context = dependencies();
  assert.deepEqual(await deleteCurrentAccount(ACCOUNT_DELETE_CONFIRMATION, context.value), { status: "deleted" });
  assert.deepEqual(context.calls, ["authenticate", "storage:owner-a", "auth-delete:owner-a", "sign-out"]);
});

test("caller cannot select another account", async () => {
  const context = dependencies();
  await deleteCurrentAccount(ACCOUNT_DELETE_CONFIRMATION, context.value);
  assert.equal(context.calls.includes("auth-delete:owner-b"), false);
});

test("storage failure stops before Auth deletion", async () => {
  const context = dependencies({ removeOwnedStorageObjects: async (id) => { context.calls.push(`storage:${id}`); return false; } });
  assert.deepEqual(await deleteCurrentAccount(ACCOUNT_DELETE_CONFIRMATION, context.value), { status: "storage_unavailable" });
  assert.deepEqual(context.calls, ["authenticate", "storage:owner-a"]);
});

test("Auth deletion failure is sanitized and does not claim success", async () => {
  const context = dependencies({ deleteAuthUser: async (id) => { context.calls.push(`auth-delete:${id}`); return false; } });
  assert.deepEqual(await deleteCurrentAccount(ACCOUNT_DELETE_CONFIRMATION, context.value), { status: "account_unavailable" });
  assert.deepEqual(context.calls, ["authenticate", "storage:owner-a", "auth-delete:owner-a"]);
});

test("session clearing failure returns a safe terminal state", async () => {
  const context = dependencies({ clearSession: async () => { context.calls.push("sign-out"); return false; } });
  assert.deepEqual(await deleteCurrentAccount(ACCOUNT_DELETE_CONFIRMATION, context.value), { status: "session_unavailable" });
});

test("action target is server-derived and admin-only", () => {
  const action = readFileSync("app/(app)/settings/actions.ts", "utf8");
  const form = readFileSync(
    "components/settings/delete-account-form.tsx",
    "utf8",
  );
  const admin = readFileSync("lib/supabase/admin.ts", "utf8");
  assert.match(action, /^"use server"/);
  assert.doesNotMatch(action, /export\s+(?:const|let|var)\s+/);
  assert.match(form, /const INITIAL_DELETE_ACCOUNT_STATE/);
  assert.match(action, /supabase\.auth\.getUser\(\)/);
  assert.match(action, /admin\.auth\.admin\.deleteUser\(userId, false\)/);
  assert.match(action, /supabase\.auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(action, /redirect\("\/start\?account_deleted=1"\)/);
  assert.doesNotMatch(action, /formData\.get\(["']userId["']\)/);
  assert.match(admin, /import "server-only"/);
  assert.doesNotMatch(action, /SUPABASE_SECRET_KEY|service.role/i);
});

test("storage cleanup invents no buckets", () => {
  const storage = readFileSync("lib/account/remove-owned-storage-objects.ts", "utf8");
  assert.match(storage, /USER_OWNED_STORAGE_LOCATIONS = Object\.freeze\(\[\]\)/);
  assert.doesNotMatch(storage, /\.storage\.from\(|avatars|uploads/i);
});

test("all auth.users references cascade or anonymize shared attribution", () => {
  const sources = [
    "202607090001_initial_mvp_schema.sql",
    "202607090002_product_led_onboarding_delta.sql",
    "202607090003_board_intake_export_v3.sql",
    "202607130002_master_profile_guest_import.sql",
    "202607130016_atomic_parser_analysis_credits.sql",
    "20260716042744_append_only_parser_analysis_credit_events.sql",
    "20260720180155_tailoring_generation_reservations.sql",
  ].map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"));
  const references = sources.flatMap(
    (source) =>
      source.match(
        /references auth\.users(?:\(id\))? on delete (?:cascade|set null)/gi,
      ) ?? [],
  );
  assert.ok(references.length >= 15);
  references.forEach((reference) => assert.match(reference, /on delete (cascade|set null)$/i));
  assert.equal(references.filter((reference) => /set null$/i.test(reference)).length, 2);
});

test("Settings exposes an accessible destructive confirmation", () => {
  const page = readFileSync("app/(app)/settings/page.tsx", "utf8");
  const form = readFileSync("components/settings/delete-account-form.tsx", "utf8");
  assert.match(page, /<DeleteAccountForm \/>/);
  assert.match(form, /htmlFor="delete-account-confirmation"/);
  assert.match(form, /id="delete-account-confirmation"/);
  assert.match(form, /Type \{ACCOUNT_DELETE_CONFIRMATION\} to confirm/);
  assert.match(form, /role="alert"/);
  assert.match(form, /Delete account permanently/);
  assert.match(form, /cannot be undone/i);
});
