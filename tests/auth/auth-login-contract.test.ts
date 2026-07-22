import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isGoogleAuthEnabled } from "../../lib/auth/config";

const actions = readFileSync("app/login/actions.ts", "utf8");
const loginPage = readFileSync("app/login/page.tsx", "utf8");

test("Google auth is disabled by default and requires an exact opt-in", () => {
  assert.equal(isGoogleAuthEnabled({}), false);
  assert.equal(isGoogleAuthEnabled({ GOOGLE_AUTH_ENABLED: "false" }), false);
  assert.equal(isGoogleAuthEnabled({ GOOGLE_AUTH_ENABLED: "TRUE" }), false);
  assert.equal(isGoogleAuthEnabled({ GOOGLE_AUTH_ENABLED: "true" }), true);
});

test("login UI hides Google unless the server flag is enabled", () => {
  assert.match(loginPage, /const googleAuthEnabled = isGoogleAuthEnabled\(\)/);
  assert.match(loginPage, /\{googleAuthEnabled \?/);
  assert.match(loginPage, /<GoogleSignInOption enabled \/>/);
});

test("password login and signup precede the secondary magic-link option", () => {
  const passwordForm = loginPage.indexOf(
    "action={signupMode ? signUpWithPassword : signInWithPassword}",
  );
  const magicLinkForm = loginPage.indexOf("action={signInWithEmail}");
  assert.ok(passwordForm >= 0);
  assert.ok(magicLinkForm > passwordForm);
  assert.match(actions, /supabase\.auth\.signInWithPassword/);
  assert.match(actions, /supabase\.auth\.signUp/);
  assert.match(loginPage, /Forgot password\?/);
});

test("password errors remain fixed and provider details stay server-only", () => {
  assert.match(loginPage, /invalid_credentials: "The email or password is incorrect\."/);
  assert.match(actions, /reportAuthFailure\("password_sign_in", error\)/);
  assert.match(actions, /reportAuthFailure\("password_sign_up", error\)/);
  assert.doesNotMatch(loginPage, /error\.message|JSON\.stringify\(error\)/);
});

test("Google action fails closed before reaching Supabase OAuth", () => {
  const gate = actions.indexOf("if (!isGoogleAuthEnabled())");
  const oauth = actions.indexOf("supabase.auth.signInWithOAuth");
  assert.ok(gate >= 0);
  assert.ok(oauth > gate);
  assert.match(actions, /error: "google_sign_in_failed"/);
});

test("email errors retain fixed browser copy and add only safe diagnostics", () => {
  assert.match(
    loginPage,
    /email_sign_in_failed: "We could not send the sign-in link\. Try again\."/,
  );
  assert.match(actions, /reportAuthFailure\("email_sign_in", error\)/);
  assert.doesNotMatch(actions, /error\.message|JSON\.stringify\(error\)/);
});
