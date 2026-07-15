import assert from "node:assert/strict";
import test from "node:test";

import { classifyJobExtractionConfidence } from "../../lib/ai/job-extraction-confidence";
import {
  JOB_EXTRACTION_CONTRACT_VERSION,
  JOB_EXTRACTION_LIMITS,
  parseJobExtractionOutput,
} from "../../lib/ai/schemas/job-extraction";

function validExtraction() {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "  Clio  ", confidence: 0.98 },
    title: { value: " Software Developer Co-op ", confidence: 0.97 },
    location: { value: "Vancouver, BC", confidence: 0.9 },
    workMode: { value: "Hybrid", confidence: 0.88 },
    term: { value: "Fall 2026 - 4 months", confidence: 0.84 },
    deadline: { value: "2028-02-29", confidence: 0.92 },
    namedSkills: {
      value: [" TypeScript ", "React", "PostgreSQL"],
      confidence: 0.87,
    },
    responsibilities: {
      value: ["Build accessible product features."],
      confidence: 0.82,
    },
    requirements: {
      value: ["Enrolled in a Canadian co-op program."],
      confidence: 0.85,
    },
    overallConfidence: 0.91,
  };
}

function expectInvalid(output: unknown) {
  const result = parseJobExtractionOutput(output);
  assert.deepEqual(result, {
    status: "invalid",
    reason: "invalid_structured_output",
  });
}

test("accepts and normalizes a fully valid versioned extraction", () => {
  const result = parseJobExtractionOutput(validExtraction());

  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;

  assert.equal(result.extraction.contractVersion, JOB_EXTRACTION_CONTRACT_VERSION);
  assert.equal(result.extraction.companyName.value, "Clio");
  assert.equal(result.extraction.title.value, "Software Developer Co-op");
  assert.deepEqual(result.extraction.namedSkills.value, [
    "TypeScript",
    "React",
    "PostgreSQL",
  ]);
  assert.equal(result.reviewClassification, "normal_review");
});

test("accepts honest null and empty partial fields", () => {
  const output = validExtraction();
  output.location.value = null as never;
  output.workMode.value = null as never;
  output.term.value = null as never;
  output.deadline.value = null as never;
  output.namedSkills.value = [];
  output.responsibilities.value = null as never;
  output.requirements.value = [];

  const result = parseJobExtractionOutput(output);
  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;
  assert.equal(result.extraction.location.value, null);
  assert.deepEqual(result.extraction.namedSkills.value, []);
  assert.equal(result.extraction.responsibilities.value, null);
});

test("uses exact confidence boundaries", () => {
  const lowBoundary = validExtraction();
  lowBoundary.overallConfidence = 0.4;
  const normalBoundary = validExtraction();
  normalBoundary.overallConfidence = 0.75;
  const belowLow = validExtraction();
  belowLow.overallConfidence = 0.399999;

  const low = parseJobExtractionOutput(lowBoundary);
  const normal = parseJobExtractionOutput(normalBoundary);
  const manual = parseJobExtractionOutput(belowLow);

  assert.equal(low.status === "valid" && low.reviewClassification, "low_confidence_review");
  assert.equal(normal.status === "valid" && normal.reviewClassification, "normal_review");
  assert.equal(manual.status === "valid" && manual.reviewClassification, "manual_review");
});

test("forces manual review when company is missing", () => {
  const output = validExtraction();
  output.companyName.value = null as never;
  const result = parseJobExtractionOutput(output);
  assert.equal(result.status === "valid" && result.reviewClassification, "manual_review");
});

test("forces manual review when title is missing", () => {
  const output = validExtraction();
  output.title.value = null as never;
  const result = parseJobExtractionOutput(output);
  assert.equal(result.status === "valid" && result.reviewClassification, "manual_review");
});

test("forces manual review for blank normalized identity fields", () => {
  const result = parseJobExtractionOutput(validExtraction());
  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;

  assert.equal(
    classifyJobExtractionConfidence({
      ...result.extraction,
      companyName: { value: "   ", confidence: 0.99 },
    }),
    "manual_review",
  );
});

test("rejects confidence values outside zero through one", () => {
  const below = validExtraction();
  below.overallConfidence = -0.01;
  const above = validExtraction();
  above.companyName.confidence = 1.01;
  expectInvalid(below);
  expectInvalid(above);
});

test("rejects NaN and non-finite confidence values", () => {
  const nan = validExtraction();
  nan.overallConfidence = Number.NaN;
  const infinity = validExtraction();
  infinity.title.confidence = Number.POSITIVE_INFINITY;
  expectInvalid(nan);
  expectInvalid(infinity);
});

test("rejects unknown top-level and nested fields", () => {
  expectInvalid({ ...validExtraction(), matchScore: 92 });

  const nested = validExtraction();
  expectInvalid({
    ...nested,
    title: { ...nested.title, inferred: true },
  });
});

test("rejects non-canonical work modes", () => {
  const output = validExtraction();
  output.workMode.value = "Flexible";
  expectInvalid(output);
});

test("accepts a valid leap day and rejects impossible dates", () => {
  assert.equal(parseJobExtractionOutput(validExtraction()).status, "valid");

  const impossible = validExtraction();
  impossible.deadline.value = "2028-02-30";
  expectInvalid(impossible);
});

test("rejects blank supplied strings", () => {
  const scalar = validExtraction();
  scalar.location.value = "   ";
  const arrayItem = validExtraction();
  arrayItem.namedSkills.value = ["TypeScript", "  "];
  expectInvalid(scalar);
  expectInvalid(arrayItem);
});

test("rejects excessive scalar and array-item lengths", () => {
  const scalar = validExtraction();
  scalar.companyName.value = "c".repeat(JOB_EXTRACTION_LIMITS.companyName + 1);
  const item = validExtraction();
  item.requirements.value = [
    "r".repeat(JOB_EXTRACTION_LIMITS.requirements.itemLength + 1),
  ];
  expectInvalid(scalar);
  expectInvalid(item);
});

test("rejects excessive array lengths", () => {
  const output = validExtraction();
  output.responsibilities.value = Array.from(
    { length: JOB_EXTRACTION_LIMITS.responsibilities.items + 1 },
    (_, index) => `Responsibility ${index}`,
  );
  expectInvalid(output);
});

test("rejects duplicate normalized skills and requirements", () => {
  const skills = validExtraction();
  skills.namedSkills.value = ["TypeScript", "  typescript  "];
  const requirements = validExtraction();
  requirements.requirements.value = [
    "Experience with SQL",
    "experience   with sql",
  ];
  expectInvalid(skills);
  expectInvalid(requirements);
});

test("rejects malformed nested confidence objects", () => {
  const output = validExtraction();
  const withoutConfidence = { value: output.title.value };
  expectInvalid({ ...output, title: withoutConfidence });
  expectInvalid({ ...output, title: "Software Developer Co-op" });
});

test("returns an intentional invalid result without raw payload or fallbacks", () => {
  const privateMarker = "PRIVATE_RAW_JD_MARKER";
  const providerMarker = "RAW_PROVIDER_PAYLOAD_MARKER";
  const result = parseJobExtractionOutput({
    companyName: "Invented company",
    title: "Invented title",
    requirements: [privateMarker, providerMarker],
  });
  const serialized = JSON.stringify(result);

  assert.deepEqual(result, {
    status: "invalid",
    reason: "invalid_structured_output",
  });
  assert.equal(serialized.includes(privateMarker), false);
  assert.equal(serialized.includes(providerMarker), false);
  assert.equal("companyName" in result, false);
  assert.equal("title" in result, false);
  assert.equal("requirements" in result, false);
});
