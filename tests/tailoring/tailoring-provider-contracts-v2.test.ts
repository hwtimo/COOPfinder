import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import {
  TAILORING_PLAN_OUTPUT_CONTRACT_VERSION,
  TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
} from "../../lib/tailoring/tailoring-provider-contracts";
import {
  TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
  TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS,
  tailoringPlanOutputV2Schema,
  tailoringProviderInputV2Schema,
  validateTailoringPlanOutputV2,
} from "../../lib/tailoring/tailoring-provider-contracts-v2";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "./tailoring-v2-fixtures";

function providerInputV2() {
  const result = buildTailoringProviderInputV2(
    readyPreflightV2(),
    resumeSourceSnapshotV2(),
  );
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("expected v2 input");
  return result.input;
}

test("builds deterministic IDs and an immutable v2 source projection", () => {
  const preflight = readyPreflightV2();
  const snapshot = resumeSourceSnapshotV2();
  const beforePreflight = structuredClone(preflight);
  const beforeSnapshot = structuredClone(snapshot);
  const first = buildTailoringProviderInputV2(preflight, snapshot);
  const second = buildTailoringProviderInputV2(preflight, snapshot);

  assert.equal(first.status, "success");
  assert.deepEqual(second, first);
  assert.deepEqual(preflight, beforePreflight);
  assert.deepEqual(snapshot, beforeSnapshot);
  if (first.status !== "success") return;
  assert.equal(first.input.contractVersion, TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION);
  assert.deepEqual(
    first.input.entries.map((entry) => entry.entryId),
    ["entry_001", "entry_002"],
  );
  assert.deepEqual(
    first.input.entries.flatMap((entry) =>
      entry.fragments.map((fragment) => fragment.fragmentId),
    ),
    ["fragment_001_001", "fragment_001_002", "fragment_002_001"],
  );
  assert.deepEqual(
    first.input.evidence.map((item) => item.evidenceId),
    [
      "skill_001",
      "skill_002",
      "technology_001",
      "technology_002",
      "certification_001",
      "language_001",
    ],
  );
  assert.equal(Object.isFrozen(first.input), true);
  assert.equal(Object.isFrozen(first.input.entries), true);
});

test("includes only safe job, identity, education, approved fragments, and structured evidence", () => {
  const snapshot = resumeSourceSnapshotV2() as ResumeSourceSnapshotWithUnsafeFields;
  snapshot.rawEntryProse = "PRIVATE_RAW_ENTRY_PROSE";
  snapshot.guestImportProse = "PRIVATE_GUEST_IMPORT_PROSE";
  snapshot.storageUserId = "PRIVATE_STORAGE_USER_ID";
  const result = buildTailoringProviderInputV2(readyPreflightV2(), snapshot);

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.deepEqual(result.input.identity, {
    fullName: "Avery Chen",
    email: "avery@example.invalid",
  });
  assert.deepEqual(result.input.education, {
    school: "SFU",
    program: "Computing Science",
    gradYear: "2027",
    coopTerm: "Fall 2026",
  });
  assert.deepEqual(
    result.input.unsupportedClaimProhibitions,
    TAILORING_V2_UNSUPPORTED_CLAIM_PROHIBITIONS,
  );
  const serialized = JSON.stringify(result.input);
  assert.doesNotMatch(serialized, /PRIVATE_RAW|PRIVATE_GUEST|PRIVATE_STORAGE/);
  assert.doesNotMatch(
    serialized,
    /"rawText"|"raw_text"|"extraction"|"reservation"|"credit"|"generatedResume"/i,
  );
  assert.doesNotMatch(serialized, /00000000-0000-4000-8000-000000000099/);
});

type ResumeSourceSnapshotWithUnsafeFields = ReturnType<
  typeof resumeSourceSnapshotV2
> & {
  rawEntryProse?: string;
  guestImportProse?: string;
  storageUserId?: string;
};

test("keeps requirements as context and exposes selectable source categories explicitly", () => {
  const input = providerInputV2();
  assert.deepEqual(
    input.jobRequirements.matched.map((item) => item.requirementId),
    ["requirement_001", "requirement_002", "requirement_003", "requirement_004"],
  );
  assert.equal(input.jobRequirements.notEvidenced[0].requirement, "Kubernetes");
  assert.equal(
    input.jobRequirements.responsibilities[0].responsibility,
    "Build reliable interfaces",
  );
  assert.deepEqual(
    input.evidence.map(({ category, term }) => ({ category, term })),
    [
      { category: "skill", term: "TypeScript" },
      { category: "skill", term: "Accessibility" },
      { category: "technology", term: "React" },
      { category: "technology", term: "PostgreSQL" },
      { category: "certification", term: "AWS Certified Cloud Practitioner" },
      { category: "language", term: "French" },
    ],
  );
});

test("validates one strict reference-only v2 plan against its concrete input", () => {
  const result = validateTailoringPlanOutputV2(
    providerInputV2(),
    validTailoringPlanV2(),
  );
  assert.equal(result.status, "valid");
  if (result.status !== "valid") return;
  assert.equal(Object.isFrozen(result.plan), true);
  const serialized = JSON.stringify(result.plan);
  assert.doesNotMatch(
    serialized,
    /summary|bullet|heading|employer|role|date|metric|achievement|markdown|html/i,
  );
});

test("rejects unknown keys and every provider-authored prose field", () => {
  for (const mutate of [
    (plan: Record<string, unknown>) => {
      plan.summary = "Provider-authored prose";
    },
    (plan: Record<string, unknown>) => {
      plan.heading = "Invented heading";
    },
    (plan: Record<string, unknown>) => {
      plan.employer = "Invented employer";
    },
  ]) {
    const plan = structuredClone(validTailoringPlanV2()) as unknown as Record<
      string,
      unknown
    >;
    mutate(plan);
    assert.equal(tailoringPlanOutputV2Schema.safeParse(plan).success, false);
  }

  const unknownInput = structuredClone(providerInputV2()) as unknown as Record<
    string,
    unknown
  >;
  unknownInput.profileId = "private";
  assert.equal(tailoringProviderInputV2Schema.safeParse(unknownInput).success, false);
});

test("rejects duplicate, unknown, context-only, and incompatible references", () => {
  const input = providerInputV2();
  const duplicate = structuredClone(validTailoringPlanV2());
  duplicate.sections[2].evidenceIds.push("skill_001");

  const unknownEntry = structuredClone(validTailoringPlanV2());
  unknownEntry.sections[1].entries[0].entryId = "entry_999";

  const unknownFragment = structuredClone(validTailoringPlanV2());
  unknownFragment.sections[1].entries[0].fragmentIds = [
    "fragment_999_001",
  ];

  const contextOnly = structuredClone(validTailoringPlanV2());
  contextOnly.sections[2].evidenceIds = ["requirement_001"];

  const incompatible = structuredClone(validTailoringPlanV2());
  incompatible.sections[2].evidenceIds = ["technology_001"];
  incompatible.sections.splice(3, 1);

  assert.deepEqual(validateTailoringPlanOutputV2(input, duplicate), {
    status: "invalid",
    reason: "invalid_shape",
  });
  assert.deepEqual(validateTailoringPlanOutputV2(input, unknownEntry), {
    status: "invalid",
    reason: "unknown_entry",
  });
  assert.deepEqual(validateTailoringPlanOutputV2(input, unknownFragment), {
    status: "invalid",
    reason: "unknown_fragment",
  });
  assert.deepEqual(validateTailoringPlanOutputV2(input, contextOnly), {
    status: "invalid",
    reason: "context_only_reference",
  });
  assert.deepEqual(validateTailoringPlanOutputV2(input, incompatible), {
    status: "invalid",
    reason: "incompatible_section",
  });
});

test("rejects duplicate sections, entries, fragments, evidence, and empty content", () => {
  const input = providerInputV2();
  const duplicateSection = structuredClone(validTailoringPlanV2());
  duplicateSection.sections.push({
    type: "skills",
    entries: [],
    evidenceIds: ["skill_002"],
  });
  const duplicateEntry = structuredClone(validTailoringPlanV2());
  duplicateEntry.sections[1].entries.push({
    entryId: "entry_001",
    fragmentIds: ["fragment_001_001"],
  });
  const empty = structuredClone(validTailoringPlanV2());
  empty.sections[2].evidenceIds = [];

  for (const plan of [duplicateSection, duplicateEntry]) {
    assert.deepEqual(validateTailoringPlanOutputV2(input, plan), {
      status: "invalid",
      reason: "invalid_shape",
    });
  }
  assert.deepEqual(validateTailoringPlanOutputV2(input, empty), {
    status: "invalid",
    reason: "invalid_shape",
  });
});

test("invalid preflight and snapshot fail safely without a partial input", () => {
  assert.deepEqual(
    buildTailoringProviderInputV2(
      { ...readyPreflightV2(), readiness: "insufficient_candidate_data" },
      resumeSourceSnapshotV2(),
    ),
    { status: "not_ready", readiness: "insufficient_candidate_data" },
  );
  assert.deepEqual(
    buildTailoringProviderInputV2(readyPreflightV2(), {
      ...resumeSourceSnapshotV2(),
      contractVersion: "wrong",
    } as never),
    { status: "invalid_snapshot" },
  );

  const unconfirmed = structuredClone(resumeSourceSnapshotV2()) as unknown as {
    entries: Array<{ fragments: Array<{ confirmed: boolean }> }>;
  };
  unconfirmed.entries[0].fragments[0].confirmed = false;
  assert.deepEqual(
    buildTailoringProviderInputV2(readyPreflightV2(), unconfirmed as never),
    { status: "invalid_snapshot" },
  );
});

test("v1 contracts remain separately versioned and unchanged", () => {
  assert.equal(TAILORING_PROVIDER_INPUT_CONTRACT_VERSION, "tailoring-provider-input-v1");
  assert.equal(TAILORING_PLAN_OUTPUT_CONTRACT_VERSION, "tailoring-plan-output-v1");
  assert.equal(TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION, "tailoring-provider-input-v2");
  assert.equal(TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION, "tailoring-plan-output-v2");
});

test("v2 contracts and builder have no database, provider, credit, route, or UI activity", () => {
  const source = [
    "lib/tailoring/tailoring-provider-contracts-v2.ts",
    "lib/tailoring/build-tailoring-provider-input-v2.ts",
  ]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.doesNotMatch(
    source,
    /fetch\s*\(|supabase|openai|reserve|finalize|persist|revalidatePath|next\/navigation|components\//i,
  );
});
