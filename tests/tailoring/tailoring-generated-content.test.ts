import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTailoringGeneratedContent,
  buildTailoringGeneratedContentReviewViewModel,
  parseTailoringGeneratedContent,
  tailoringGeneratedContentV1Schema,
} from "../../lib/tailoring/tailoring-generated-content";
import {
  immutableTailoringProviderInput,
  TAILORING_PROHIBITED_CLAIM_CATEGORIES,
  tailoringProviderInputV1Schema,
  type TailoringPlanOutputV1,
} from "../../lib/tailoring/tailoring-provider-contracts";

function input() {
  return immutableTailoringProviderInput(
    tailoringProviderInputV1Schema.parse({
      contractVersion: "tailoring-provider-input-v1",
      job: {
        title: "Software Developer",
        companyName: "Example Co",
        location: "Vancouver, BC",
      },
      approvedCandidateEvidence: [
        {
          evidenceId: "ev_001",
          category: "technology",
          term: "TypeScript",
          sourceType: "explicit_technology",
          sourceLabel: "Technologies",
        },
        {
          evidenceId: "ev_002",
          category: "language",
          term: "French",
          sourceType: "explicit_language",
          sourceLabel: "Languages",
          languageProficiency: "professional",
        },
        {
          evidenceId: "ev_003",
          category: "soft_skill",
          term: "Communication",
          sourceType: "explicit_soft_skill",
        },
        {
          evidenceId: "ev_004",
          category: "certification",
          term: "Unused certification",
          sourceType: "explicit_certification",
        },
      ],
      jobContext: {
        matchedRequirements: [
          {
            category: "required_technology",
            modality: "required",
            requirement: "TypeScript",
            evidenceId: "ev_001",
          },
          {
            category: "language",
            modality: "non_modal",
            requirement: "French",
            evidenceId: "ev_002",
          },
          {
            category: "soft_skill",
            modality: "non_modal",
            requirement: "Communication",
            evidenceId: "ev_003",
          },
        ],
        notEvidencedRequirements: [
          {
            contextId: "ctx_001",
            category: "preferred_technology",
            requirement: "React",
          },
        ],
        responsibilities: [
          { contextId: "ctx_002", responsibility: "Private job prose" },
        ],
        unassessed: { total: 0, categories: [] },
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

const plan: TailoringPlanOutputV1 = {
  contractVersion: "tailoring-plan-output-v1",
  summaryEvidenceIds: ["ev_002"],
  sections: [
    { type: "technologies", items: [{ evidenceId: "ev_001" }] },
    { type: "soft_skills", items: [{ evidenceId: "ev_003" }] },
  ],
};

function content() {
  const result = buildTailoringGeneratedContent(input(), plan, "a".repeat(64));
  assert.equal(result.status, "success");
  return result.content;
}

test("builds a strict deterministic snapshot in summary-first traversal order", () => {
  const first = content();
  const second = content();
  assert.deepEqual(first, second);
  assert.equal(first.contractVersion, "tailoring-generated-content-v1");
  assert.equal(
    first.providerInputContractVersion,
    "tailoring-provider-input-v1",
  );
  assert.equal(
    first.providerOutputContractVersion,
    "tailoring-plan-output-v1",
  );
  assert.equal(first.inputFingerprint, "a".repeat(64));
  assert.deepEqual(
    first.selectedEvidence.map((item) => item.evidenceId),
    ["ev_002", "ev_001", "ev_003"],
  );
  assert.equal(
    first.selectedEvidence.some((item) => item.evidenceId === "ev_004"),
    false,
  );
});

test("copies only safe job metadata and selected evidence", () => {
  const serialized = JSON.stringify(content());
  for (const prohibited of [
    "Private job prose",
    "ctx_001",
    "ctx_002",
    "approvedCandidateEvidence",
    "jobContext",
    "raw_text",
    "extracted",
    "email",
    "userId",
    "reservation",
    "credit",
    "prompt",
    "diagnostic",
    "summaryProse",
    "bullets",
  ]) {
    assert.equal(serialized.includes(prohibited), false);
  }
  assert.deepEqual(content().job, {
    title: "Software Developer",
    companyName: "Example Co",
    location: "Vancouver, BC",
  });
});

test("rejects malformed input, fingerprint, unknown evidence, context, and incompatible sections", () => {
  assert.equal(
    buildTailoringGeneratedContent(input(), plan, "bad").status,
    "invalid",
  );
  for (const unsafePlan of [
    { ...plan, summaryEvidenceIds: ["ev_999"] },
    { ...plan, summaryEvidenceIds: ["ctx_001"] },
    {
      ...plan,
      summaryEvidenceIds: [],
      sections: [
        { type: "certifications", items: [{ evidenceId: "ev_001" }] },
      ],
    },
    {
      ...plan,
      summaryEvidenceIds: ["ev_001"],
      sections: [
        { type: "technologies", items: [{ evidenceId: "ev_001" }] },
      ],
    },
  ]) {
    assert.equal(
      buildTailoringGeneratedContent(
        input(),
        unsafePlan as TailoringPlanOutputV1,
        "a".repeat(64),
      ).status,
      "invalid",
    );
  }
});

test("strict parser rejects unknown keys, extras, missing evidence, duplicates, and unsafe prose fields", () => {
  const valid = content();
  assert.equal(parseTailoringGeneratedContent(valid).status, "valid");
  const cases = [
    { ...valid, diagnostics: {} },
    { ...valid, summary: "Provider-authored prose" },
    { ...valid, selectedEvidence: valid.selectedEvidence.slice(1) },
    {
      ...valid,
      selectedEvidence: [
        ...valid.selectedEvidence,
        valid.selectedEvidence[0],
      ],
    },
    {
      ...valid,
      selectedEvidence: [
        ...valid.selectedEvidence,
        {
          evidenceId: "ev_004",
          category: "certification",
          term: "Unreferenced",
          sourceType: "explicit_certification",
        },
      ],
    },
    {
      ...valid,
      selectedEvidence: valid.selectedEvidence.map((item, index) =>
        index === 0 ? { ...item, profileId: "private" } : item,
      ),
    },
  ];
  for (const value of cases) {
    assert.equal(parseTailoringGeneratedContent(value).status, "invalid");
  }
});

test("plan-only rows return the explicit legacy state", () => {
  assert.deepEqual(parseTailoringGeneratedContent(plan), {
    status: "legacy_content_unavailable",
  });
});

test("view model resolves stored terms and provenance without current profile or job data", () => {
  const result = buildTailoringGeneratedContentReviewViewModel(content());
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.deepEqual(result.viewModel.jobHeading, {
    title: "Software Developer",
    companyName: "Example Co",
    location: "Vancouver, BC",
  });
  assert.deepEqual(result.viewModel.summaryEvidence, [
    {
      term: "French",
      categoryLabel: "Language",
      provenanceLabel: "Languages",
      languageProficiency: "professional",
    },
  ]);
  assert.deepEqual(
    result.viewModel.sections.map((section) => ({
      label: section.label,
      terms: section.evidence.map((item) => item.term),
    })),
    [
      { label: "Technologies", terms: ["TypeScript"] },
      { label: "Soft skills", terms: ["Communication"] },
    ],
  );
  assert.equal("overallScore" in result.viewModel, false);
  assert.equal("qualificationVerdict" in result.viewModel, false);
});

test("malformed content cannot produce a partial review", () => {
  assert.deepEqual(
    buildTailoringGeneratedContentReviewViewModel({
      ...content(),
      selectedEvidence: [],
    }),
    { status: "invalid_content" },
  );
});

test("builder does not mutate input or plan", () => {
  const providerInput = input();
  const planValue = structuredClone(plan);
  const beforeInput = JSON.stringify(providerInput);
  const beforePlan = JSON.stringify(planValue);
  buildTailoringGeneratedContent(providerInput, planValue, "a".repeat(64));
  assert.equal(JSON.stringify(providerInput), beforeInput);
  assert.equal(JSON.stringify(planValue), beforePlan);
});

test("runtime schema rejects malformed enums and free-form nested fields", () => {
  const valid = content();
  assert.equal(
    tailoringGeneratedContentV1Schema.safeParse({
      ...valid,
      selectedEvidence: valid.selectedEvidence.map((item, index) =>
        index === 0 ? { ...item, category: "employer" } : item,
      ),
    }).success,
    false,
  );
});
