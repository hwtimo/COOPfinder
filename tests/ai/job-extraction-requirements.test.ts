import assert from "node:assert/strict";
import test from "node:test";

import { JOB_EXTRACTION_PROVIDER_INSTRUCTIONS } from "../../lib/ai/openai-job-extraction-provider";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  parseJobExtractionOutput,
} from "../../lib/ai/schemas/job-extraction";
import { jobExtractionWireV1Schema } from "../../lib/ai/schemas/job-extraction-wire";
import { normalizeJobRequirements } from "../../lib/jobs/job-requirement-normalization";

function structuredRequirements() {
  return {
    requiredSkills: ["Problem solving"],
    preferredSkills: ["Clear communication"],
    requiredTechnologies: ["TypeScript"],
    preferredTechnologies: ["PostgreSQL"],
    education: ["Enrolled in a computer science degree"],
    certifications: ["AWS Certified Cloud Practitioner"],
    languages: ["Professional proficiency in French"],
    workAuthorization: ["Eligible to work in Canada"],
    experience: ["Two years of web development experience"],
    responsibilities: ["Build accessible product features"],
    softSkills: ["Collaborative"],
    keywords: ["SaaS"],
    uncategorizedRequirements: ["Able to attend the annual team event"],
  };
}

function extraction(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Example", confidence: 0.9 },
    title: { value: "Developer", confidence: 0.9 },
    location: { value: null, confidence: 0 },
    workMode: { value: null, confidence: 0 },
    term: { value: null, confidence: 0 },
    deadline: { value: null, confidence: 0 },
    namedSkills: { value: ["TypeScript", "PostgreSQL"], confidence: 0.8 },
    responsibilities: {
      value: ["Build accessible product features"],
      confidence: 0.8,
    },
    requirements: {
      value: ["Eligible to work in Canada"],
      confidence: 0.8,
    },
    structuredRequirements: structuredRequirements(),
    overallConfidence: 0.88,
    ...overrides,
  };
}

function legacyExtraction() {
  const legacy: Record<string, unknown> = extraction();
  delete legacy.structuredRequirements;
  return legacy;
}

const categoryExpectations = [
  ["requiredSkills", "Problem solving"],
  ["preferredSkills", "Clear communication"],
  ["requiredTechnologies", "TypeScript"],
  ["preferredTechnologies", "PostgreSQL"],
  ["education", "Enrolled in a computer science degree"],
  ["certifications", "AWS Certified Cloud Practitioner"],
  ["languages", "Professional proficiency in French"],
  ["workAuthorization", "Eligible to work in Canada"],
  ["experience", "Two years of web development experience"],
  ["responsibilities", "Build accessible product features"],
  ["softSkills", "Collaborative"],
  ["keywords", "SaaS"],
  ["uncategorizedRequirements", "Able to attend the annual team event"],
] as const;

for (const [category, expected] of categoryExpectations) {
  test(`reconstructs explicit ${category} without inventing values`, () => {
    const parsed = parseJobExtractionOutput(extraction());

    assert.equal(parsed.status, "valid");
    if (parsed.status !== "valid") return;
    assert.deepEqual(parsed.canonicalRequirements[category], [expected]);
  });
}

test("provider wire requires structured requirements and every category", () => {
  assert.equal(jobExtractionWireV1Schema.safeParse(extraction()).success, true);

  const legacy = legacyExtraction();
  assert.equal(jobExtractionWireV1Schema.safeParse(legacy).success, false);

  const incomplete = structuredRequirements();
  delete (incomplete as Partial<typeof incomplete>).languages;
  assert.equal(
    jobExtractionWireV1Schema.safeParse(
      extraction({ structuredRequirements: incomplete }),
    ).success,
    false,
  );
});

test("provider wire accepts empty arrays for every absent category", () => {
  const empty = Object.fromEntries(
    Object.keys(structuredRequirements()).map((category) => [category, []]),
  );

  assert.equal(
    jobExtractionWireV1Schema.safeParse(
      extraction({ structuredRequirements: empty }),
    ).success,
    true,
  );
});

test("persisted runtime schema accepts legacy rows without the new object", () => {
  const legacy = legacyExtraction();
  const parsed = parseJobExtractionOutput(legacy);

  assert.equal(parsed.status, "valid");
  if (parsed.status !== "valid") return;
  assert.deepEqual(parsed.canonicalRequirements.keywords, [
    "TypeScript",
    "PostgreSQL",
  ]);
  assert.deepEqual(parsed.canonicalRequirements.responsibilities, [
    "Build accessible product features",
  ]);
  assert.deepEqual(parsed.canonicalRequirements.uncategorizedRequirements, [
    "Eligible to work in Canada",
  ]);
});

test("malformed present structured data fails instead of using legacy fields", () => {
  const malformedValues = [
    null,
    { ...structuredRequirements(), requiredSkills: "TypeScript" },
    { ...structuredRequirements(), requiredSkills: ["TypeScript", 42] },
  ];

  for (const structured of malformedValues) {
    assert.deepEqual(
      parseJobExtractionOutput(
        extraction({ structuredRequirements: structured }),
      ),
      { status: "invalid", reason: "invalid_structured_output" },
    );
  }
});

test("unknown structured and top-level keys remain rejected", () => {
  assert.equal(
    parseJobExtractionOutput(
      extraction({
        structuredRequirements: {
          ...structuredRequirements(),
          inferredSkills: ["PRIVATE_INVENTED_SKILL"],
        },
      }),
    ).status,
    "invalid",
  );
  assert.equal(
    parseJobExtractionOutput(extraction({ inferredRequirements: [] })).status,
    "invalid",
  );
});

test("structured normalization removes duplicates and preserves first spelling and order", () => {
  const input = extraction({
    structuredRequirements: {
      ...structuredRequirements(),
      requiredSkills: [
        "  Problem   solving ",
        "PROBLEM SOLVING",
        "Debugging",
      ],
    },
  });

  assert.deepEqual(normalizeJobRequirements(input).requiredSkills, [
    "Problem solving",
    "Debugging",
  ]);
  assert.deepEqual(normalizeJobRequirements(input), normalizeJobRequirements(input));
});

test("valid structured requirements are the only canonical source path", () => {
  const canonical = normalizeJobRequirements(
    extraction({
      namedSkills: { value: ["LEGACY_KEYWORD"], confidence: 0.8 },
      responsibilities: {
        value: ["LEGACY_RESPONSIBILITY"],
        confidence: 0.8,
      },
      requirements: { value: ["LEGACY_REQUIREMENT"], confidence: 0.8 },
    }),
  );

  assert.deepEqual(canonical.keywords, ["SaaS"]);
  assert.deepEqual(canonical.responsibilities, [
    "Build accessible product features",
  ]);
  assert.deepEqual(canonical.uncategorizedRequirements, [
    "Able to attend the annual team event",
  ]);
  assert.equal(JSON.stringify(canonical).includes("LEGACY_"), false);
});

test("does not duplicate a concrete technology into the general-skill category", () => {
  const canonical = normalizeJobRequirements(extraction());

  assert.deepEqual(canonical.requiredTechnologies, ["TypeScript"]);
  assert.equal(canonical.requiredSkills.includes("TypeScript"), false);
  assert.equal(canonical.keywords.includes("TypeScript"), false);
});

test("prompt enforces conservative modality, deduplication, and no inference", () => {
  for (const instruction of [
    "required, mandatory, must",
    "preferred, an asset, nice to have, a bonus",
    "Do not duplicate a concrete technology as a general skill",
    "Never promote ambiguous language to required",
    "never invent an unstated qualification",
    "remains a responsibility",
  ]) {
    assert.equal(JOB_EXTRACTION_PROVIDER_INSTRUCTIONS.includes(instruction), true);
  }
});
