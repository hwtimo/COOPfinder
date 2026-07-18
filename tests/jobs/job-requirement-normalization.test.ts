import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_JOB_REQUIREMENTS_VERSION,
  normalizeJobRequirements,
} from "../../lib/jobs/job-requirement-normalization";

function extraction(overrides: Record<string, unknown> = {}) {
  return {
    namedSkills: {
      value: [" TypeScript ", "React", "PostgreSQL"],
      confidence: 0.9,
    },
    responsibilities: {
      value: ["Build accessible product features."],
      confidence: 0.8,
    },
    requirements: {
      value: ["Enrolled in a Canadian co-op program."],
      confidence: 0.8,
    },
    ...overrides,
  };
}

test("removes duplicates case-insensitively while preserving first-seen order and casing", () => {
  const result = normalizeJobRequirements(
    extraction({
      namedSkills: {
        value: ["TypeScript", " react ", "TYPESCRIPT", "React", "SQL"],
      },
    }),
  );

  assert.deepEqual(result.keywords, ["TypeScript", "react", "SQL"]);
});

test("collapses whitespace, ignores empty values, and keeps stable source ordering", () => {
  const result = normalizeJobRequirements(
    extraction({
      responsibilities: {
        value: [
          "  Build   accessible\nfeatures. ",
          "\t",
          "Collaborate   with design.",
          "Build accessible features.",
        ],
      },
    }),
  );

  assert.deepEqual(result.responsibilities, [
    "Build accessible features.",
    "Collaborate with design.",
  ]);
});

test("tolerates missing optional fields and malformed collection values", () => {
  const result = normalizeJobRequirements({
    namedSkills: { value: null },
    requirements: { value: ["  Degree required  ", null, 42, ""] },
  });

  assert.deepEqual(result.keywords, []);
  assert.deepEqual(result.responsibilities, []);
  assert.deepEqual(result.uncategorizedRequirements, ["Degree required"]);
});

test("returns the complete empty canonical model for an empty extraction", () => {
  assert.deepEqual(normalizeJobRequirements({}), {
    contractVersion: CANONICAL_JOB_REQUIREMENTS_VERSION,
    requiredSkills: [],
    preferredSkills: [],
    requiredTechnologies: [],
    preferredTechnologies: [],
    education: [],
    certifications: [],
    languages: [],
    workAuthorization: [],
    experience: [],
    responsibilities: [],
    softSkills: [],
    keywords: [],
    uncategorizedRequirements: [],
  });
});

test("returns the same canonical value on repeated execution", () => {
  const input = extraction({
    requirements: {
      value: ["  Three years of experience ", "THREE YEARS OF EXPERIENCE"],
    },
  });

  const first = normalizeJobRequirements(input);
  const second = normalizeJobRequirements(input);

  assert.deepEqual(second, first);
  assert.notEqual(second, first);
  assert.deepEqual(input, extraction({
    requirements: {
      value: ["  Three years of experience ", "THREE YEARS OF EXPERIENCE"],
    },
  }));
});

test("returns an empty canonical model for null or non-object extraction input", () => {
  assert.deepEqual(
    normalizeJobRequirements(null),
    normalizeJobRequirements("not an extraction"),
  );
});
