import assert from "node:assert/strict";
import test from "node:test";

import {
  immutableTailoringProviderInput,
  TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
  TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
  tailoringPlanOutputV1Schema,
  tailoringProviderInputV1Schema,
  validateTailoringPlanOutput,
  type TailoringProviderInputV1,
} from "../../lib/tailoring/tailoring-provider-contracts";

function providerInput(): TailoringProviderInputV1 {
  return immutableTailoringProviderInput(
    tailoringProviderInputV1Schema.parse({
      contractVersion: TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
      job: {
        title: "Product Developer",
        companyName: "Example Company",
        location: "Vancouver, BC",
      },
      approvedCandidateEvidence: [
        {
          evidenceId: "ev_001",
          category: "general_skill",
          term: "TypeScript",
          sourceType: "top_level_general_skill",
          sourceLabel: "General skills",
        },
        {
          evidenceId: "ev_002",
          category: "technology",
          term: "React",
          sourceType: "explicit_technology",
          sourceLabel: "Technologies",
        },
        {
          evidenceId: "ev_003",
          category: "soft_skill",
          term: "Communication",
          sourceType: "explicit_soft_skill",
          sourceLabel: "Soft skills",
        },
        {
          evidenceId: "ev_004",
          category: "certification",
          term: "AWS Certified Cloud Practitioner",
          sourceType: "explicit_certification",
          sourceLabel: "Certifications",
        },
        {
          evidenceId: "ev_005",
          category: "language",
          term: "French",
          sourceType: "explicit_language",
          sourceLabel: "Languages",
          languageProficiency: "fluent",
        },
        {
          evidenceId: "ev_006",
          category: "keyword",
          term: "Git",
          sourceType: "top_level_general_skill",
          sourceLabel: "General skills",
        },
      ],
      jobContext: {
        matchedRequirements: [
          {
            category: "required_skill",
            modality: "required",
            requirement: "TypeScript",
            evidenceId: "ev_001",
          },
        ],
        notEvidencedRequirements: [
          {
            contextId: "ctx_001",
            category: "required_technology",
            requirement: "Kubernetes",
          },
        ],
        responsibilities: [
          { contextId: "ctx_002", responsibility: "Build reliable products" },
        ],
        unassessed: {
          total: 1,
          categories: [
            { contextId: "ctx_003", category: "education", count: 1 },
          ],
        },
        workAuthorization: {
          status: "no_job_requirement",
          jobRequirements: [],
          candidateValue: null,
        },
      },
      prohibitedClaimCategories: [...TAILORING_PROHIBITED_CLAIM_CATEGORIES],
    }),
  );
}

function validPlan() {
  return {
    contractVersion: TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    summaryEvidenceIds: ["ev_006"],
    sections: [
      { type: "general_skills", items: [{ evidenceId: "ev_001" }] },
      { type: "technologies", items: [{ evidenceId: "ev_002" }] },
      { type: "soft_skills", items: [{ evidenceId: "ev_003" }] },
      { type: "certifications", items: [{ evidenceId: "ev_004" }] },
      { type: "languages", items: [{ evidenceId: "ev_005" }] },
    ],
  };
}

test("input runtime contract rejects unknown keys, duplicate facts, and incompatible provenance", () => {
  const unknown = structuredClone(providerInput()) as unknown as Record<
    string,
    unknown
  >;
  unknown.privateIdentity = "not allowed";

  const duplicate = structuredClone(providerInput()) as unknown as {
    approvedCandidateEvidence: Array<Record<string, unknown>>;
  };
  duplicate.approvedCandidateEvidence.push({
    ...duplicate.approvedCandidateEvidence[0],
    evidenceId: "ev_099",
  });

  const incompatible = structuredClone(providerInput()) as unknown as {
    approvedCandidateEvidence: Array<Record<string, unknown>>;
  };
  incompatible.approvedCandidateEvidence[0].category = "technology";

  const replacedProhibitions = structuredClone(providerInput()) as unknown as {
    prohibitedClaimCategories: string[];
  };
  replacedProhibitions.prohibitedClaimCategories = ["skills"];

  for (const value of [
    unknown,
    duplicate,
    incompatible,
    replacedProhibitions,
  ]) {
    assert.equal(tailoringProviderInputV1Schema.safeParse(value).success, false);
  }
});

test("accepts a strict immutable reference-only plan bound to approved evidence", () => {
  const result = validateTailoringPlanOutput(providerInput(), validPlan());

  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;
  assert.deepEqual(result.plan, validPlan());
  assert.equal(Object.isFrozen(result.plan), true);
  assert.equal(Object.isFrozen(result.plan.sections), true);
  assert.equal("summary" in result.plan, false);
  assert.equal("bullet" in result.plan.sections[0].items[0], false);
});

for (const [name, mutate] of [
  ["wrong contract version", (plan: Record<string, unknown>) => { plan.contractVersion = "wrong"; }],
  ["unknown top-level key", (plan: Record<string, unknown>) => { plan.extra = true; }],
  ["free-form summary", (plan: Record<string, unknown>) => { plan.summary = "Invented prose"; }],
  ["employer field", (plan: Record<string, unknown>) => { plan.employer = "Invented employer"; }],
] as const) {
  test(`rejects ${name}`, () => {
    const plan = structuredClone(validPlan()) as unknown as Record<string, unknown>;
    mutate(plan);
    assert.deepEqual(validateTailoringPlanOutput(providerInput(), plan), {
      status: "invalid",
      reason: "invalid_shape",
    });
  });
}

test("rejects unknown section and item keys, including bullets and altered terms", () => {
  for (const mutate of [
    (plan: ReturnType<typeof validPlan>) => {
      Object.assign(plan.sections[0], { title: "Skills" });
    },
    (plan: ReturnType<typeof validPlan>) => {
      Object.assign(plan.sections[0].items[0], { bullet: "Invented metric" });
    },
    (plan: ReturnType<typeof validPlan>) => {
      Object.assign(plan.sections[0].items[0], { term: "Altered TypeScript" });
    },
  ]) {
    const plan = structuredClone(validPlan());
    mutate(plan);
    assert.equal(tailoringPlanOutputV1Schema.safeParse(plan).success, false);
  }
});

test("rejects blank and oversized evidence IDs", () => {
  for (const evidenceId of ["", "x".repeat(17)]) {
    const plan = structuredClone(validPlan());
    plan.sections[0].items[0].evidenceId = evidenceId;
    assert.deepEqual(validateTailoringPlanOutput(providerInput(), plan), {
      status: "invalid",
      reason: "invalid_shape",
    });
  }
});

test("enforces summary, section, and item collection limits", () => {
  const excessiveSummary = {
    contractVersion: TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    summaryEvidenceIds: Array.from({ length: 9 }, (_, index) => `ev_${index}`),
    sections: [],
  };
  const excessiveSections = {
    contractVersion: TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    summaryEvidenceIds: [],
    sections: Array.from({ length: 7 }, (_, index) => ({
      type: index === 0 ? "general_skills" : `invalid_${index}`,
      items: [{ evidenceId: "ev_001" }],
    })),
  };
  const excessiveItems = {
    contractVersion: TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    summaryEvidenceIds: [],
    sections: [
      {
        type: "general_skills",
        items: Array.from({ length: 13 }, (_, index) => ({
          evidenceId: `ev_${String(index).padStart(3, "0")}`,
        })),
      },
    ],
  };

  for (const plan of [excessiveSummary, excessiveSections, excessiveItems]) {
    assert.equal(tailoringPlanOutputV1Schema.safeParse(plan).success, false);
  }
});

test("rejects duplicate section types and duplicate evidence globally", () => {
  const duplicateSection = structuredClone(validPlan());
  duplicateSection.sections.push({
    type: "general_skills",
    items: [{ evidenceId: "ev_007" }],
  });
  const duplicateSummary = structuredClone(validPlan());
  duplicateSummary.summaryEvidenceIds.push("ev_006");
  const duplicateAcrossPlan = structuredClone(validPlan());
  duplicateAcrossPlan.summaryEvidenceIds = ["ev_001"];

  for (const plan of [duplicateSection, duplicateSummary, duplicateAcrossPlan]) {
    assert.deepEqual(validateTailoringPlanOutput(providerInput(), plan), {
      status: "invalid",
      reason: "invalid_shape",
    });
  }
});

test("rejects empty sections", () => {
  const plan = structuredClone(validPlan());
  plan.sections[0].items = [];
  assert.deepEqual(validateTailoringPlanOutput(providerInput(), plan), {
    status: "invalid",
    reason: "invalid_shape",
  });
});

test("rejects unknown and context-only references against the concrete input", () => {
  const unknown = structuredClone(validPlan());
  unknown.sections[0].items[0].evidenceId = "ev_999";
  const contextOnly = structuredClone(validPlan());
  contextOnly.sections[0].items[0].evidenceId = "ctx_001";

  assert.deepEqual(validateTailoringPlanOutput(providerInput(), unknown), {
    status: "invalid",
    reason: "unknown_evidence",
  });
  assert.deepEqual(validateTailoringPlanOutput(providerInput(), contextOnly), {
    status: "invalid",
    reason: "context_only_reference",
  });
});

test("enforces category-compatible placement while allowing safe supporting evidence", () => {
  const incompatible = structuredClone(validPlan());
  incompatible.sections[0].items[0].evidenceId = "ev_002";
  incompatible.sections.splice(1, 1);
  assert.deepEqual(validateTailoringPlanOutput(providerInput(), incompatible), {
    status: "invalid",
    reason: "incompatible_section",
  });

  const supporting = {
    contractVersion: TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
    summaryEvidenceIds: [],
    sections: [
      {
        type: "supporting_evidence",
        items: [
          { evidenceId: "ev_001" },
          { evidenceId: "ev_002" },
          { evidenceId: "ev_003" },
          { evidenceId: "ev_004" },
          { evidenceId: "ev_005" },
          { evidenceId: "ev_006" },
        ],
      },
    ],
  };
  assert.equal(validateTailoringPlanOutput(providerInput(), supporting).status, "valid");

  supporting.sections[0].items[0].evidenceId = "ctx_001";
  assert.equal(validateTailoringPlanOutput(providerInput(), supporting).status, "invalid");
});

test("accepts technology, certification, and language evidence only in compatible sections", () => {
  const result = validateTailoringPlanOutput(providerInput(), validPlan());
  assert.equal(result.status, "valid");
});

test("validation is deterministic and does not mutate the input or output", () => {
  const input = providerInput();
  const plan = validPlan();
  const inputBefore = structuredClone(input);
  const planBefore = structuredClone(plan);

  assert.deepEqual(
    validateTailoringPlanOutput(input, plan),
    validateTailoringPlanOutput(input, plan),
  );
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(plan, planBefore);
});

test("rejects malformed provider input before considering a plan", () => {
  const input = structuredClone(providerInput()) as unknown as {
    contractVersion: string;
  };
  input.contractVersion = "wrong-input";
  assert.deepEqual(
    validateTailoringPlanOutput(
      input as unknown as TailoringProviderInputV1,
      validPlan(),
    ),
    { status: "invalid", reason: "invalid_input" },
  );
});

test("contracts have no provider, database, credit, persistence, route, or UI operation", () => {
  const source = `${tailoringPlanOutputV1Schema.toString()} ${validateTailoringPlanOutput.toString()}`;
  assert.doesNotMatch(
    source,
    /fetch|openai|supabase|database|credit|reservation|persist|router|component/i,
  );
});
