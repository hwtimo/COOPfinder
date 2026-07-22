import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyPasswordUpdateFailure,
  getPasswordResetErrorCopy,
} from "../../lib/auth/password-reset";

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

test("same-password rejection has safe accurate copy and preserves retry flow", () => {
  assert.equal(
    classifyPasswordUpdateFailure({
      code: "same_password",
      status: 422,
      message: "private provider detail",
    }),
    "same_password",
  );
  assert.equal(
    getPasswordResetErrorCopy("same_password"),
    "Choose a different password.",
  );
  assert.match(resetAction, /classifyPasswordUpdateFailure\(error\)/);
  assert.doesNotMatch(resetAction, /error\.message/);
  assert.ok(
    resetAction.indexOf("classifyPasswordUpdateFailure(error)") <
      resetAction.indexOf("await supabase.auth.signOut()"),
  );
});

test("unknown and invalid reset sessions retain unavailable copy", () => {
  assert.equal(classifyPasswordUpdateFailure({ code: "session_expired" }), "reset_failed");
  assert.equal(
    getPasswordResetErrorCopy("reset_session_required"),
    "This reset session is unavailable or expired. Request a new link.",
  );
  assert.equal(
    getPasswordResetErrorCopy("reset_failed"),
    "This reset session is unavailable or expired. Request a new link.",
  );
});

test("callback and refresh responses retain private no-store headers", () => {
  assert.match(callback, /Cache-Control/);
  assert.match(callback, /canonical_auth_required/);
  assert.match(middleware, /Object\.entries\(headersToSet\)/);
});
