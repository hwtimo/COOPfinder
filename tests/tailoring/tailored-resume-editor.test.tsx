import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  moveEditableResumeBullet,
  removeEditableResumeBullet,
  toUserEditedTailoredResumeInput,
  updateEditableResumeBullet,
  type EditableResumeEntry,
} from "../../components/app/tailored-resume-editor-state";

const initialEntries: readonly EditableResumeEntry[] = [
  {
    entryId: "entry_001",
    heading: "Frontend Developer",
    bullets: [
      { fragmentId: "fragment_001", text: "First bullet." },
      { fragmentId: "fragment_002", text: "Second bullet." },
      { fragmentId: "fragment_003", text: "Third bullet." },
    ],
  },
];

test("editing bullet wording is immutable and serializes the user edit contract", () => {
  const updated = updateEditableResumeBullet(
    initialEntries,
    "entry_001",
    "fragment_002",
    "User-edited second bullet.",
  );
  assert.equal(initialEntries[0].bullets[1].text, "Second bullet.");
  assert.equal(updated[0].bullets[1].text, "User-edited second bullet.");
  assert.deepEqual(toUserEditedTailoredResumeInput(updated), {
    contractVersion: "user-edited-tailored-resume-input-v1",
    entries: [
      {
        entryId: "entry_001",
        bullets: [
          { fragmentId: "fragment_001", text: "First bullet." },
          {
            fragmentId: "fragment_002",
            text: "User-edited second bullet.",
          },
          { fragmentId: "fragment_003", text: "Third bullet." },
        ],
      },
    ],
  });
});

test("remove and reorder operations preserve stable bullet identities", () => {
  const moved = moveEditableResumeBullet(
    initialEntries,
    "entry_001",
    "fragment_001",
    "down",
  );
  assert.deepEqual(
    moved[0].bullets.map((bullet) => bullet.fragmentId),
    ["fragment_002", "fragment_001", "fragment_003"],
  );
  const removed = removeEditableResumeBullet(
    moved,
    "entry_001",
    "fragment_001",
  );
  assert.deepEqual(
    removed[0].bullets.map((bullet) => bullet.fragmentId),
    ["fragment_002", "fragment_003"],
  );
  assert.deepEqual(
    initialEntries[0].bullets.map((bullet) => bullet.fragmentId),
    ["fragment_001", "fragment_002", "fragment_003"],
  );
});

test("removing the last bullet removes its empty entry for server validation", () => {
  const removed = removeEditableResumeBullet(
    [
      {
        entryId: "entry_001",
        heading: "Frontend Developer",
        bullets: [{ fragmentId: "fragment_001", text: "Only bullet." }],
      },
    ],
    "entry_001",
    "fragment_001",
  );
  assert.deepEqual(removed, []);
  assert.deepEqual(toUserEditedTailoredResumeInput(removed).entries, []);
});

test("generated originals expose accessible edit controls and safe save feedback", () => {
  const component = readFileSync(
    "components/app/tailored-resume-editor.tsx",
    "utf8",
  );
  const state = readFileSync(
    "components/app/tailored-resume-editor-state.ts",
    "utf8",
  );
  const inputContract = readFileSync(
    "lib/tailoring/user-edited-tailored-resume-input.ts",
    "utf8",
  );
  assert.match(component, /Edit generated original/);
  assert.match(component, /generated original remains unchanged/);
  assert.match(component, /Save as new version/);
  assert.match(component, /Reset changes/);
  assert.match(component, /aria-label=\{`Move bullet \$\{index \+ 1\} up/);
  assert.match(component, /aria-label=\{`Move bullet \$\{index \+ 1\} down/);
  assert.match(component, /aria-label=\{`Remove bullet \$\{index \+ 1\}/);
  assert.match(component, /disabled=\{pending \|\| bulletCount === 0\}/);
  assert.match(component, /role="alert"/);
  assert.doesNotMatch(
    `${component}\n${state}\n${inputContract}`,
    /openai|provider|credit|reservation|ledger|window\.print/i,
  );
  assert.doesNotMatch(
    `${state}\n${inputContract}`,
    /node:crypto|tailored-resume-document|user-edited-tailored-resume-version/,
  );
});

test("server action validates, creates one child, and redirects to that persisted version", () => {
  const action = readFileSync(
    "app/(app)/resumes/versions/[versionId]/actions.ts",
    "utf8",
  );
  assert.match(action, /^"use server";/);
  assert.doesNotMatch(
    action,
    /export\s+(?:const|let|var|class)\s+/,
    '"use server" modules may only expose async runtime functions',
  );
  assert.match(action, /userEditedTailoredResumeInputV1Schema\.safeParse/);
  assert.match(action, /createOwnedUserEditedTailoredResumeVersion\(/);
  assert.match(
    action,
    /redirect\(`\/resumes\/versions\/\$\{result\.resumeVersionId\}`\)/,
  );
  assert.match(action, /Keep at least one non-empty bullet/);
  assert.doesNotMatch(
    action,
    /openai|provider|credit|reservation|ledger|\.insert\(|\.update\(/i,
  );
});

test("review route distinguishes version authorship and prints the opened persisted review", () => {
  const page = readFileSync(
    "app/(app)/resumes/versions/[versionId]/page.tsx",
    "utf8",
  );
  assert.match(page, /Generated original/);
  assert.match(page, /User-edited version/);
  assert.match(page, /result\.versionKind === "generated_original"/);
  assert.match(page, /href="#edit-version"/);
  assert.match(page, /<TailoredResumeEditor/);
  assert.match(page, /<ResumeVersionPrintButton/);
  assert.match(page, /<TailoredResumeReview version=\{result\}/);
  assert.doesNotMatch(page, /createOwnedUserEdited|\.insert\(|\.update\(/);
});
