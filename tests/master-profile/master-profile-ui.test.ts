import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(
  "app/(app)/resumes/master/master-profile-client.tsx",
  "utf8",
);

test("Master Profile keeps existing general skills and adds one compact evidence section", () => {
  assert.match(client, /<Field label="Skills">/);
  assert.equal((client.match(/title="Skills and credentials"/g) ?? []).length, 1);
  for (const label of ["Technologies", "Soft skills", "Certifications"]) {
    assert.equal(client.includes(`<Field label="${label}">`), true);
  }
});

test("language rows use associated labels, bounded proficiency, and accessible controls", () => {
  assert.match(client, /htmlFor=\{languageId\}/);
  assert.match(client, /htmlFor=\{proficiencyId\}/);
  assert.match(client, /CANDIDATE_LANGUAGE_PROFICIENCIES\.map/);
  assert.match(client, /Add language/);
  assert.match(client, /aria-label=\{`Remove language \$\{index \+ 1\}`\}/);
});

test("candidate evidence controls remain one-column on mobile and use existing patterns", () => {
  assert.match(client, /grid gap-4 sm:grid-cols-2/);
  assert.match(client, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_auto\]/);
  assert.match(client, /<CardSection/);
  assert.doesNotMatch(client, /completeness score|AI suggestion|autocomplete/i);
});

test("client-side language keys are not included in persisted evidence", () => {
  assert.match(client, /type LanguageRow = \{\s*key: string/);
  assert.match(client, /raw\.languages = languageRows\.map\(\(row\) => \(\{/);
  assert.doesNotMatch(client, /raw\.languages[\s\S]{0,200}key: row\.key/);
});

test("resume bullet controls are explicit, accessible, and never split entry prose", () => {
  assert.match(client, /Resume bullets/);
  assert.match(client, /Only approved bullets may be used in generated resumes/);
  assert.match(client, /Approved for tailoring/);
  assert.match(client, /Approve for tailoring/);
  assert.match(client, /Add bullet/);
  assert.match(client, /htmlFor=\{textId\}/);
  assert.match(client, /htmlFor=\{tagsId\}/);
  assert.match(client, /aria-label=\{`Move resume bullet \$\{index \+ 1\} up`\}/);
  assert.match(client, /aria-label=\{`Move resume bullet \$\{index \+ 1\} down`\}/);
  assert.match(client, /aria-label=\{`Remove resume bullet \$\{index \+ 1\}`\}/);
  assert.match(client, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(client, /split\(entry\.text|entry\.text\.split|auto.*split/i);
});

test("editing a bullet revokes approval until the user approves it again", () => {
  assert.match(
    client,
    /text: event\.target\.value,\s*confirmed: false/,
  );
  assert.match(
    client,
    /evidenceTags: commaValues\(event\.target\.value\),\s*confirmed: false/,
  );
});
