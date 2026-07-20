import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCandidateEvidence,
  parseStoredCandidateEvidence,
} from "../../lib/master-profile/candidate-evidence";
import { validateMasterProfilePayload } from "../../lib/master-profile/validation";

function profilePayload(overrides: Record<string, unknown> = {}) {
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
    entries: [],
    ...overrides,
  };
}

test("existing profiles remain valid without candidate evidence", () => {
  assert.deepEqual(parseCandidateEvidence(undefined), { status: "absent" });
  const validated = validateMasterProfilePayload(profilePayload());
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.data.candidateEvidence, undefined);
});

test("strict valid evidence normalizes strings and preserves category presence", () => {
  const result = parseCandidateEvidence({
    technologies: ["  TypeScript ", "PostgreSQL"],
    softSkills: ["Clear   communication"],
    certifications: [" AWS Certified Developer "],
    languages: [
      { language: " French ", proficiency: "professional" },
      { language: "Japanese" },
    ],
  });

  assert.deepEqual(result, {
    status: "valid",
    evidence: {
      technologies: ["TypeScript", "PostgreSQL"],
      softSkills: ["Clear communication"],
      certifications: ["AWS Certified Developer"],
      languages: [
        { language: "French", proficiency: "professional" },
        { language: "Japanese" },
      ],
    },
  });
});

for (const [label, value] of [
  ["non-object", []],
  ["unknown evidence key", { technologies: [], inferred: [] }],
  ["malformed evidence array", { softSkills: "Communication" }],
  ["malformed language entry", { languages: ["French"] }],
  ["unknown language key", { languages: [{ language: "French", note: "private" }] }],
  ["unknown proficiency", { languages: [{ language: "French", proficiency: "expert" }] }],
] as const) {
  test(`rejects ${label}`, () => {
    assert.deepEqual(parseCandidateEvidence(value), { status: "invalid" });
  });
}

test("deduplicates case-insensitively with stable first spelling and order", () => {
  const result = parseCandidateEvidence({
    technologies: [" TypeScript ", "typescript", "React", " REACT "],
    certifications: ["AWS", " aws ", "Azure"],
  });

  assert.deepEqual(result, {
    status: "valid",
    evidence: {
      technologies: ["TypeScript", "React"],
      certifications: ["AWS", "Azure"],
    },
  });
});

test("deduplicates languages by normalized name and keeps the first valid occurrence", () => {
  assert.deepEqual(
    parseCandidateEvidence({
      languages: [
        { language: " French ", proficiency: "conversational" },
        { language: "FRENCH", proficiency: "native" },
        { language: "  " },
        { language: "Spanish", proficiency: "fluent" },
      ],
    }),
    {
      status: "valid",
      evidence: {
        languages: [
          { language: "French", proficiency: "conversational" },
          { language: "Spanish", proficiency: "fluent" },
        ],
      },
    },
  );
});

test("empty objects and arrays remain present for intentional clearing", () => {
  assert.deepEqual(parseCandidateEvidence({}), {
    status: "valid",
    evidence: {},
  });
  assert.deepEqual(parseCandidateEvidence({ technologies: [], languages: [] }), {
    status: "valid",
    evidence: { technologies: [], languages: [] },
  });
});

test("form validation and stored parsing share one normalized round trip", () => {
  const validated = validateMasterProfilePayload(
    profilePayload({
      candidateEvidence: {
        technologies: ["  Node.js  ", "NODE.JS"],
        languages: [{ language: " Korean ", proficiency: "native" }],
      },
    }),
  );
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  const stored = parseStoredCandidateEvidence({
    skills: [],
    candidateEvidence: validated.data.candidateEvidence,
  });
  assert.deepEqual(stored, {
    status: "valid",
    evidence: {
      technologies: ["Node.js"],
      languages: [{ language: "Korean", proficiency: "native" }],
    },
  });
});

test("malformed stored evidence fails safely", () => {
  assert.deepEqual(
    parseStoredCandidateEvidence({ candidateEvidence: { languages: null } }),
    { status: "invalid" },
  );
});

test("candidate evidence normalization is deterministic and does not mutate input", () => {
  const input = {
    technologies: [" TypeScript ", "typescript"],
    languages: [{ language: " French ", proficiency: "fluent" }],
  };
  const snapshot = structuredClone(input);
  assert.deepEqual(parseCandidateEvidence(input), parseCandidateEvidence(input));
  assert.deepEqual(input, snapshot);
});
