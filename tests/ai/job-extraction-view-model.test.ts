import assert from "node:assert/strict";
import test from "node:test";

import { buildJobExtractionViewModel } from "../../lib/ai/job-extraction-view-model";
import { JOB_EXTRACTION_CONTRACT_VERSION } from "../../lib/ai/schemas/job-extraction";

function validExtraction() {
  return {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Clio", confidence: 0.9 },
    title: { value: "Software Developer Co-op", confidence: 0.9 },
    location: { value: "Vancouver, BC", confidence: 0.8 },
    workMode: { value: "Hybrid", confidence: 0.8 },
    term: { value: "Fall 2026", confidence: 0.8 },
    deadline: { value: "2026-09-01", confidence: 0.8 },
    namedSkills: { value: ["TypeScript", "PostgreSQL"], confidence: 0.8 },
    responsibilities: { value: ["Build accessible features."], confidence: 0.8 },
    requirements: { value: ["Review generated output."], confidence: 0.8 },
    overallConfidence: 0.85,
  };
}

test("builds a read-only view model from valid stored extraction", () => {
  assert.deepEqual(buildJobExtractionViewModel(validExtraction(), 0.85), {
    status: "ready",
    company: "Clio",
    title: "Software Developer Co-op",
    location: "Vancouver, BC",
    workMode: "Hybrid",
    term: "Fall 2026",
    deadline: "2026-09-01",
    namedSkills: ["TypeScript", "PostgreSQL"],
    responsibilities: ["Build accessible features."],
    requirements: ["Review generated output."],
    overallConfidence: 0.85,
    reviewClassification: "normal_review",
  });
});

test("returns not generated for null or default-empty extraction", () => {
  assert.deepEqual(buildJobExtractionViewModel(null, null), {
    status: "not_generated",
  });
  assert.deepEqual(buildJobExtractionViewModel({}, null), {
    status: "not_generated",
  });
});

test("returns unavailable for malformed stored extraction", () => {
  assert.deepEqual(
    buildJobExtractionViewModel({ companyName: "Unvalidated company" }, 0.9),
    { status: "unavailable" },
  );
});

test("returns unavailable for the wrong contract version", () => {
  const extraction = validExtraction();
  extraction.contractVersion = "future-contract" as never;

  assert.deepEqual(buildJobExtractionViewModel(extraction, 0.85), {
    status: "unavailable",
  });
});

test("represents missing optional fields honestly", () => {
  const extraction = validExtraction();
  extraction.companyName.value = null as never;
  extraction.location.value = null as never;
  extraction.workMode.value = null as never;
  extraction.term.value = null as never;
  extraction.deadline.value = null as never;
  extraction.namedSkills.value = null as never;
  extraction.responsibilities.value = null as never;
  extraction.requirements.value = null as never;

  const result = buildJobExtractionViewModel(extraction, 0.85);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.company, null);
  assert.equal(result.location, null);
  assert.equal(result.workMode, null);
  assert.equal(result.term, null);
  assert.equal(result.deadline, null);
  assert.deepEqual(result.namedSkills, []);
  assert.deepEqual(result.responsibilities, []);
  assert.deepEqual(result.requirements, []);
});

test("uses stored confidence and canonical review classification", () => {
  const extraction = validExtraction();
  extraction.overallConfidence = 0.5;

  const result = buildJobExtractionViewModel(extraction, 0.51);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.equal(result.overallConfidence, 0.51);
  assert.equal(result.reviewClassification, "low_confidence_review");
});

test("unavailable results expose no raw JSON or validation details", () => {
  const privateMarker = "PRIVATE_INVALID_EXTRACTION_MARKER";
  const result = buildJobExtractionViewModel(
    { contractVersion: "wrong", raw: privateMarker },
    0.9,
  );
  const serialized = JSON.stringify(result);

  assert.deepEqual(result, { status: "unavailable" });
  assert.equal(serialized.includes(privateMarker), false);
  assert.equal(serialized.includes("contractVersion"), false);
  assert.equal(serialized.includes("validation"), false);
});
