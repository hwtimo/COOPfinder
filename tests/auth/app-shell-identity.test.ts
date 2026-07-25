import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildAppShellUser } from "../../lib/auth/app-shell-identity";

const layout = readFileSync("app/(app)/layout.tsx", "utf8");
const sidebar = readFileSync("components/app/app-sidebar.tsx", "utf8");
const topbar = readFileSync("components/app/app-topbar.tsx", "utf8");
const shellSources = [layout, sidebar, topbar].join("\n");

test("app shell uses real profile fields and owner-scopes the profile query", () => {
  assert.match(layout, /\.from\("profiles"\)/);
  assert.match(layout, /\.select\("full_name,school,program,coop_term"\)/);
  assert.match(layout, /\.eq\("user_id", user\.id\)/);
  assert.match(layout, /buildAppShellUser\(user, profile\)/);
});

test("app shell production files contain no mock identity imports or values", () => {
  assert.doesNotMatch(shellSources, /lib\/mock/);
  assert.doesNotMatch(shellSources, /currentUser/);
  assert.doesNotMatch(shellSources, /Maya Chen/i);
  assert.doesNotMatch(shellSources, /Fall 2026 term/i);
});

test("real profile identity is normalized for the shell", () => {
  assert.deepEqual(
    buildAppShellUser(
      {
        email: "student@example.com",
        user_metadata: { full_name: "Metadata Name" },
      },
      {
        full_name: "  Real   Student  ",
        school: " Simon Fraser University ",
        program: " Computing Science ",
        coop_term: " Fall 2027 ",
      },
    ),
    {
      name: "Real Student",
      email: "student@example.com",
      initials: "RS",
      meta: "Simon Fraser University · Computing Science",
      context: "Fall 2027",
    },
  );
});

test("missing optional profile fields use the real email and neutral context", () => {
  assert.deepEqual(
    buildAppShellUser(
      { email: "student@example.com", user_metadata: {} },
      {
        full_name: null,
        school: null,
        program: null,
        coop_term: null,
      },
    ),
    {
      name: "student@example.com",
      email: "student@example.com",
      initials: "S",
      meta: "student@example.com",
      context: "Workspace",
    },
  );
});

test("authenticated users without identity fields receive neutral fallbacks", () => {
  assert.deepEqual(buildAppShellUser({ user_metadata: {} }, null), {
    name: "Account",
    email: "",
    initials: "A",
    meta: "Account",
    context: "Workspace",
  });
  assert.equal(buildAppShellUser(null, null), null);
});
