import assert from "node:assert/strict";
import test from "node:test";

import {
  RESUME_SOURCE_FRAGMENT_LIMITS,
  approvedResumeSourceFragments,
  parseResumeSourceFragments,
} from "../../lib/master-profile/resume-source-fragments";
import { validateMasterProfilePayload } from "../../lib/master-profile/validation";

const FRAGMENT_ID = "11111111-1111-4111-8111-111111111111";

function fragment(overrides: Record<string, unknown> = {}) {
  return {
    fragmentId: FRAGMENT_ID,
    text: " Built   12 reporting dashboards. ",
    evidenceTags: [" TypeScript ", "typescript", " Data  analysis "],
    confirmed: true,
    order: 0,
    provenance: "manual",
    ...overrides,
  };
}

function profilePayload(entry: Record<string, unknown>) {
  return {
    fullName: "Candidate",
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: [],
    entries: [
      {
        id: "entry-1",
        section: "project",
        source: "Reporting project",
        text: "PRIVATE RAW ENTRY PROSE",
        skills: [],
        confirmed: true,
        sortOrder: 0,
        ...entry,
      },
    ],
  };
}

test("old profiles remain valid when resume fragments are absent", () => {
  assert.deepEqual(parseResumeSourceFragments(undefined), { status: "absent" });
  const validated = validateMasterProfilePayload(profilePayload({}));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.data.entries[0]?.resumeFragments, undefined);
});

test("strict parsing normalizes whitespace and deduplicates tags stably", () => {
  assert.deepEqual(parseResumeSourceFragments([fragment()]), {
    status: "valid",
    fragments: [
      {
        fragmentId: FRAGMENT_ID,
        text: "Built 12 reporting dashboards.",
        evidenceTags: ["TypeScript", "Data analysis"],
        confirmed: true,
        order: 0,
        provenance: "manual",
      },
    ],
  });
});

for (const [label, value] of [
  ["unknown fragment key", [fragment({ privateNote: "no" })]],
  ["blank text", [fragment({ text: "  " })]],
  ["invalid ID", [fragment({ fragmentId: "local-1" })]],
  ["unknown provenance", [fragment({ provenance: "imported" })]],
  ["malformed tags", [fragment({ evidenceTags: "TypeScript" })]],
  ["duplicate order", [fragment(), fragment({ fragmentId: "22222222-2222-4222-8222-222222222222" })]],
  ["duplicate ID", [fragment(), fragment({ order: 1 })]],
] as const) {
  test(`rejects ${label}`, () => {
    assert.deepEqual(parseResumeSourceFragments(value), { status: "invalid" });
  });
}

test("enforces fragment count, text, tag count, and tag length limits", () => {
  assert.deepEqual(
    parseResumeSourceFragments(
      Array.from(
        { length: RESUME_SOURCE_FRAGMENT_LIMITS.fragmentsPerEntry + 1 },
        () => fragment(),
      ),
    ),
    { status: "invalid" },
  );
  assert.deepEqual(
    parseResumeSourceFragments([
      fragment({ text: "x".repeat(RESUME_SOURCE_FRAGMENT_LIMITS.textLength + 1) }),
    ]),
    { status: "invalid" },
  );
  assert.deepEqual(
    parseResumeSourceFragments([
      fragment({
        evidenceTags: Array.from(
          { length: RESUME_SOURCE_FRAGMENT_LIMITS.evidenceTagsPerFragment + 1 },
          (_, index) => `tag-${index}`,
        ),
      }),
    ]),
    { status: "invalid" },
  );
  assert.deepEqual(
    parseResumeSourceFragments([
      fragment({
        evidenceTags: [
          "x".repeat(RESUME_SOURCE_FRAGMENT_LIMITS.evidenceTagLength + 1),
        ],
      }),
    ]),
    { status: "invalid" },
  );
});

test("sorts by explicit order and preserves stable IDs and first spelling", () => {
  const result = parseResumeSourceFragments([
    fragment({
      fragmentId: "22222222-2222-4222-8222-222222222222",
      text: "Second",
      order: 1,
    }),
    fragment({ text: "First", order: 0 }),
  ]);
  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;
  assert.deepEqual(
    result.fragments.map((item) => [item.fragmentId, item.text, item.order]),
    [
      [FRAGMENT_ID, "First", 0],
      ["22222222-2222-4222-8222-222222222222", "Second", 1],
    ],
  );
});

test("only explicitly confirmed fragments are eligible", () => {
  assert.deepEqual(
    approvedResumeSourceFragments([
      fragment({ confirmed: false }),
      fragment({
        fragmentId: "22222222-2222-4222-8222-222222222222",
        text: "Approved",
        order: 1,
      }),
    ]).map((item) => item.text),
    ["Approved"],
  );
});

test("validation round-trips fragments and supports explicit clearing", () => {
  const populated = validateMasterProfilePayload(
    profilePayload({ resumeFragments: [fragment()] }),
  );
  assert.equal(populated.ok, true);
  if (!populated.ok) return;
  assert.equal(populated.data.entries[0]?.resumeFragments?.length, 1);

  const cleared = validateMasterProfilePayload(
    profilePayload({ resumeFragments: [] }),
  );
  assert.equal(cleared.ok, true);
  if (!cleared.ok) return;
  assert.deepEqual(cleared.data.entries[0]?.resumeFragments, []);
});

test("parsing is deterministic and does not mutate inputs", () => {
  const input = [fragment()];
  const original = structuredClone(input);
  assert.deepEqual(
    parseResumeSourceFragments(input),
    parseResumeSourceFragments(input),
  );
  assert.deepEqual(input, original);
});
