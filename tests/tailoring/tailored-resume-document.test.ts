import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import {
  buildTailoredResumeDocument,
  fingerprintTailoringProviderInputV2,
  TAILORED_RESUME_DOCUMENT_CONTRACT_VERSION,
  tailoredResumeDocumentV1Schema,
} from "../../lib/tailoring/tailored-resume-document";
import {
  TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
} from "../../lib/tailoring/tailoring-provider-contracts-v2";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "./tailoring-v2-fixtures";

function sourceInput() {
  const result = buildTailoringProviderInputV2(
    readyPreflightV2(),
    resumeSourceSnapshotV2(),
  );
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("expected v2 input");
  return result.input;
}

function document() {
  const result = buildTailoredResumeDocument(
    sourceInput(),
    validTailoringPlanV2(),
  );
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("expected document");
  return result.document;
}

test("builds a deterministic independently renderable document", () => {
  const input = sourceInput();
  const plan = validTailoringPlanV2();
  const beforeInput = structuredClone(input);
  const beforePlan = structuredClone(plan);
  const first = buildTailoredResumeDocument(input, plan);
  const second = buildTailoredResumeDocument(input, plan);

  assert.equal(first.status, "success");
  assert.deepEqual(second, first);
  assert.deepEqual(input, beforeInput);
  assert.deepEqual(plan, beforePlan);
  if (first.status !== "success") return;
  assert.equal(first.document.contractVersion, TAILORED_RESUME_DOCUMENT_CONTRACT_VERSION);
  assert.equal(
    first.document.providerInputContractVersion,
    TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
  );
  assert.equal(
    first.document.providerPlanContractVersion,
    TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  );
  assert.equal(
    first.document.sourceFingerprint,
    fingerprintTailoringProviderInputV2(input),
  );
  assert.equal(Object.isFrozen(first.document), true);
  assert.equal(Object.isFrozen(first.document.sections), true);
});

test("copies safe identity, structured education, headings, and fragment bytes exactly", () => {
  const result = document();
  assert.deepEqual(result.identity, {
    fullName: "Avery Chen",
    email: "avery@example.invalid",
  });
  assert.deepEqual(result.education, {
    school: "SFU",
    program: "Computing Science",
    gradYear: "2027",
    coopTerm: "Fall 2026",
  });
  const experience = result.sections.find((section) => section.type === "experience");
  assert.deepEqual(experience?.entries, [
    {
      heading: "Frontend Developer",
      bullets: [
        {
          text: "Built keyboard-accessible navigation.",
          provenance: {
            entryId: "entry_001",
            fragmentId: "fragment_001_002",
          },
        },
        {
          text: "Improved latency by 37% in 2025.",
          provenance: {
            entryId: "entry_001",
            fragmentId: "fragment_001_001",
          },
        },
      ],
    },
  ]);
  assert.match(JSON.stringify(result), /37% in 2025/);
});

test("preserves provider-selected section, entry, fragment, and evidence order", () => {
  const result = document();
  assert.deepEqual(
    result.sections.map((section) => section.type),
    [
      "education",
      "experience",
      "skills",
      "technologies",
      "certifications",
      "languages",
    ],
  );
  assert.deepEqual(
    result.sections
      .flatMap((section) => section.evidence)
      .map((evidence) => evidence.term),
    ["TypeScript", "React", "AWS Certified Cloud Practitioner", "French"],
  );
  const language = result.sections
    .flatMap((section) => section.evidence)
    .find((evidence) => evidence.category === "language");
  assert.equal(language?.languageProficiency, "professional");
});

test("excludes unselected fragments, entries, evidence, and all authored prose surfaces", () => {
  const serialized = JSON.stringify(document());
  assert.doesNotMatch(serialized, /Unselected Project/);
  assert.doesNotMatch(serialized, /approved but unselected fragment/);
  assert.doesNotMatch(serialized, /PostgreSQL|Accessibility/);
  assert.doesNotMatch(
    serialized,
    /professionalSummary|summary|rawEntry|guestImport|jobDescription|extraction/i,
  );
  assert.doesNotMatch(serialized, /Example Company|Product Developer|Vancouver/);
});

test("a matched skill does not unlock unrelated entry content", () => {
  const plan = validTailoringPlanV2();
  plan.sections.splice(1, 1);
  const result = buildTailoredResumeDocument(sourceInput(), plan);
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  const serialized = JSON.stringify(result.document);
  assert.match(serialized, /TypeScript/);
  assert.doesNotMatch(serialized, /Frontend Developer|37%|keyboard-accessible/);
});

test("contains no invented headings, dates, employers, metrics, or contact fields", () => {
  const result = document() as unknown as Record<string, unknown>;
  assert.equal("summary" in result, false);
  assert.equal("phone" in result, false);
  assert.equal("address" in result, false);
  assert.equal("job" in result, false);
  for (const section of document().sections) {
    assert.deepEqual(Object.keys(section).sort(), ["entries", "evidence", "type"]);
    for (const entry of section.entries) {
      assert.deepEqual(Object.keys(entry).sort(), ["bullets", "heading"]);
      assert.equal("employer" in entry, false);
      assert.equal("role" in entry, false);
      assert.equal("date" in entry, false);
      assert.equal("metric" in entry, false);
    }
  }
});

test("strict document parsing rejects unknown fields or altered contract lineage", () => {
  const extra = structuredClone(document()) as unknown as Record<string, unknown>;
  extra.html = "<p>unsafe</p>";
  const wrongVersion = structuredClone(document()) as unknown as {
    providerPlanContractVersion: string;
  };
  wrongVersion.providerPlanContractVersion = "tailoring-plan-output-v1";
  assert.equal(tailoredResumeDocumentV1Schema.safeParse(extra).success, false);
  assert.equal(
    tailoredResumeDocumentV1Schema.safeParse(wrongVersion).success,
    false,
  );
});

test("invalid input or plan cannot produce a partial document", () => {
  const invalidInput = structuredClone(sourceInput()) as unknown as {
    contractVersion: string;
  };
  invalidInput.contractVersion = "wrong";
  const invalidPlan = structuredClone(validTailoringPlanV2()) as unknown as {
    sections: Array<{ evidenceIds: string[] }>;
  };
  invalidPlan.sections[2].evidenceIds = ["technology_001"];
  assert.deepEqual(
    buildTailoredResumeDocument(invalidInput as never, validTailoringPlanV2()),
    { status: "invalid_input" },
  );
  assert.deepEqual(buildTailoredResumeDocument(sourceInput(), invalidPlan as never), {
    status: "invalid_plan",
  });
});

test("document builder has no database, provider, credit, route, persistence, or UI activity", () => {
  const source = readFileSync(
    "lib/tailoring/tailored-resume-document.ts",
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /fetch\s*\(|supabase|openai|reserve|finalize|persist|revalidatePath|next\/navigation|components\//i,
  );
});
