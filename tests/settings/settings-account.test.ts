import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildSettingsAccount } from "../../lib/settings/account-summary";

const page = readFileSync("app/(app)/settings/page.tsx", "utf8");
const query = readFileSync("lib/settings/get-settings-account.ts", "utf8");
const productionSources = [page, query].join("\n");

test("Settings account uses normalized authenticated and profile values", () => {
  const account = buildSettingsAccount(
    {
      email: "  student@example.com ",
      user_metadata: { name: "Metadata Name" },
    },
    {
      full_name: "  Real   Student ",
      school: "  Example University ",
      program: " Computer Science ",
      coop_term: " Fall 2027 ",
    },
  );

  assert.deepEqual(account, {
    email: "student@example.com",
    name: "Real Student",
    school: "Example University",
    program: "Computer Science",
    coopTerm: "Fall 2027",
  });
  assert.equal(Object.isFrozen(account), true);
});

test("missing optional profile values remain absent without fabrication", () => {
  assert.deepEqual(
    buildSettingsAccount(
      { email: "student@example.com", user_metadata: {} },
      null,
    ),
    {
      email: "student@example.com",
      name: null,
      school: null,
      program: null,
      coopTerm: null,
    },
  );
});

test("authenticated metadata name is used only when the profile name is absent", () => {
  assert.equal(
    buildSettingsAccount(
      {
        email: "student@example.com",
        user_metadata: { full_name: " Authenticated Name " },
      },
      { full_name: null },
    ).name,
    "Authenticated Name",
  );
});

test("Settings query is server-only, authenticated, minimal, and owner-scoped", () => {
  assert.match(query, /import "server-only"/);
  assert.match(query, /supabase\.auth\.getUser\(\)/);
  assert.match(query, /\.from\("profiles"\)/);
  assert.match(query, /\.select\("full_name,school,program,coop_term"\)/);
  assert.match(query, /\.eq\("user_id", user\.id\)/);
  assert.doesNotMatch(
    query,
    /service_role|avatar|preferences|insert\(|update\(|upsert\(|delete\(/,
  );
});

test("Settings page has honest missing-data, unavailable, and read-only states", () => {
  assert.match(page, /displayValue\(result\.account\.name\)/);
  assert.match(page, /displayValue\(result\.account\.email, "Not available"\)/);
  assert.match(page, /displayValue\(result\.account\.school\)/);
  assert.match(page, /displayValue\(result\.account\.program\)/);
  assert.match(page, /displayValue\(result\.account\.coopTerm\)/);
  assert.match(page, /fallback = "Not provided"/);
  assert.match(page, /Profile editing is not available in Settings yet\./);
  assert.match(page, /No fallback data is shown\./);
  assert.match(page, /redirect\(getLoginHref\("\/settings"\)\)/);
});

test("Settings production code contains no mock profile or fabricated identity", () => {
  assert.doesNotMatch(productionSources, /lib\/mock|currentUser|Maya Chen/i);
  assert.doesNotMatch(
    productionSources,
    /maya\.chen|Simon Fraser University|Engineering \/ Computing Science|Fall 2026/i,
  );
  assert.doesNotMatch(productionSources, /avatar|preferences?/i);
});
