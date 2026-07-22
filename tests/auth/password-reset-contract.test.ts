import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requestAction = readFileSync("app/forgot-password/actions.ts", "utf8");
const resetAction = readFileSync("app/reset-password/actions.ts", "utf8");
const callback = readFileSync("app/auth/callback/route.ts", "utf8");
const middleware = readFileSync("lib/supabase/middleware.ts", "utf8");

test("forgot-password remains non-enumerating and uses the canonical PKCE callback", () => {
  assert.match(requestAction, /buildPasswordResetCallbackUrl/);
  assert.match(requestAction, /resetPasswordForEmail/);
  assert.match(requestAction, /query\.set\("sent", "1"\)/);
  assert.doesNotMatch(requestAction, /error\.message/);
});

test("password update requires the recovery session and signs out after success", () => {
  assert.match(resetAction, /supabase\.auth\.getUser\(\)/);
  assert.match(resetAction, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(resetAction, /await supabase\.auth\.signOut\(\)/);
});

test("callback and refresh responses retain private no-store headers", () => {
  assert.match(callback, /Cache-Control/);
  assert.match(callback, /canonical_auth_required/);
  assert.match(middleware, /Object\.entries\(headersToSet\)/);
});
