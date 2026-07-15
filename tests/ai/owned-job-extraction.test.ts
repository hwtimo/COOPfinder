import assert from "node:assert/strict";
import test from "node:test";

import {
  createOwnedJobExtractionOrchestrator,
  extractOwnedJobDescription,
  type OwnedJobExtractionDependencies,
} from "../../lib/ai/extract-owned-job-description";
import {
  PRIVATE_JOB_DESCRIPTION_MAX_LENGTH,
  type ExtractJobDescriptionResult,
} from "../../lib/ai/extract-job-description";
import { JOB_EXTRACTION_CONTRACT_VERSION } from "../../lib/ai/schemas/job-extraction";

const USER_ID = "2fa1b93d-91fc-41cb-a199-7aa3b9547ef5";
const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";
const OTHER_JOB_ID = "ca8b725f-f5f6-4aaa-a7f0-af9105c52b77";

const SAFE_EXTRACTION_FAILURE: ExtractJobDescriptionResult = {
  status: "provider_unavailable",
  reason: "provider_unavailable",
  retryable: true,
};

const SAFE_EXTRACTION_SUCCESS: ExtractJobDescriptionResult = {
  status: "success",
  extraction: {
    contractVersion: JOB_EXTRACTION_CONTRACT_VERSION,
    companyName: { value: "Clio", confidence: 0.9 },
    title: { value: "Software Developer Co-op", confidence: 0.9 },
    location: { value: "Vancouver, BC", confidence: 0.8 },
    workMode: { value: "Hybrid", confidence: 0.8 },
    term: { value: "Fall 2026", confidence: 0.8 },
    deadline: { value: null, confidence: 0 },
    namedSkills: { value: ["TypeScript"], confidence: 0.8 },
    responsibilities: { value: [], confidence: 0 },
    requirements: { value: [], confidence: 0 },
    overallConfidence: 0.85,
  },
  reviewClassification: "normal_review",
};

function dependencies(
  overrides: Partial<OwnedJobExtractionDependencies> = {},
): OwnedJobExtractionDependencies {
  return {
    getAuthenticatedUser: async () => ({
      status: "authenticated",
      userId: USER_ID,
    }),
    getOwnedJob: async () => ({
      status: "ready",
      job: { intakeSource: "pasted_text", rawText: "Persisted private JD" },
    }),
    extract: async () => SAFE_EXTRACTION_FAILURE,
    ...overrides,
  };
}

test("returns unauthenticated without querying or extracting", async () => {
  let lookupCalls = 0;
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getAuthenticatedUser: async () => ({ status: "unauthenticated" }),
      getOwnedJob: async () => {
        lookupCalls += 1;
        return { status: "ready", job: null };
      },
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "unauthenticated",
    retryable: false,
  });
  assert.equal(lookupCalls, 0);
  assert.equal(extractionCalls, 0);
});

test("rejects a malformed job ID before auth, lookup, or extraction", async () => {
  let authCalls = 0;
  let lookupCalls = 0;
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getAuthenticatedUser: async () => {
        authCalls += 1;
        return { status: "authenticated", userId: USER_ID };
      },
      getOwnedJob: async () => {
        lookupCalls += 1;
        return { status: "ready", job: null };
      },
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate("not-a-uuid"), {
    status: "invalid_job_id",
    retryable: false,
  });
  assert.equal(authCalls, 0);
  assert.equal(lookupCalls, 0);
  assert.equal(extractionCalls, 0);
});

test("returns the same result for foreign and nonexistent jobs", async () => {
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () => ({ status: "ready", job: null }),
    }),
  );

  const foreign = await orchestrate(JOB_ID);
  const nonexistent = await orchestrate(OTHER_JOB_ID);

  assert.deepEqual(foreign, {
    status: "job_unavailable",
    retryable: false,
  });
  assert.deepEqual(nonexistent, foreign);
});

test("constrains owned-job lookup by both job and authenticated user IDs", async () => {
  const calls: Array<{ jobId: string; userId: string }> = [];
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async (input) => {
        calls.push(input);
        return { status: "ready", job: null };
      },
    }),
  );

  await orchestrate(JOB_ID);

  assert.deepEqual(calls, [{ jobId: JOB_ID, userId: USER_ID }]);
});

for (const intakeSource of ["pasted_url", "board_save", "manual"] as const) {
  test(`rejects unsupported ${intakeSource} intake without extraction`, async () => {
    let extractionCalls = 0;
    const orchestrate = createOwnedJobExtractionOrchestrator(
      dependencies({
        getOwnedJob: async () => ({
          status: "ready",
          job: { intakeSource, rawText: "Text that must not be used" },
        }),
        extract: async () => {
          extractionCalls += 1;
          return SAFE_EXTRACTION_FAILURE;
        },
      }),
    );

    assert.deepEqual(await orchestrate(JOB_ID), {
      status: "unsupported_intake_source",
      retryable: false,
    });
    assert.equal(extractionCalls, 0);
  });
}

test("rejects null raw text without extraction", async () => {
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: { intakeSource: "pasted_text", rawText: null },
      }),
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "missing_job_description",
    retryable: false,
  });
  assert.equal(extractionCalls, 0);
});

test("rejects whitespace-only raw text without extraction", async () => {
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: { intakeSource: "pasted_text", rawText: "  \n\t  " },
      }),
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "missing_job_description",
    retryable: false,
  });
  assert.equal(extractionCalls, 0);
});

test("rejects over-limit raw text before extraction", async () => {
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: {
          intakeSource: "pasted_text",
          rawText: "x".repeat(PRIVATE_JOB_DESCRIPTION_MAX_LENGTH + 1),
        },
      }),
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "invalid_input",
    reason: "input_too_long",
    retryable: false,
  });
  assert.equal(extractionCalls, 0);
});

test("invokes extraction exactly once for an owned pasted-text job", async () => {
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), SAFE_EXTRACTION_FAILURE);
  assert.equal(extractionCalls, 1);
});

test("sends only persisted raw text to extraction without orchestration changes", async () => {
  const persistedRawText = "  Persisted private JD\nwith original spacing.  ";
  const receivedInputs: unknown[] = [];
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () => ({
        status: "ready",
        job: { intakeSource: "pasted_text", rawText: persistedRawText },
      }),
      extract: async (input) => {
        receivedInputs.push(input);
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  await orchestrate(JOB_ID);

  assert.deepEqual(receivedInputs, [persistedRawText]);
});

test("the production and injected orchestration signatures accept only job ID", () => {
  const orchestrate = createOwnedJobExtractionOrchestrator(dependencies());

  assert.equal(extractOwnedJobDescription.length, 1);
  assert.equal(orchestrate.length, 1);
});

test("query failures do not invoke extraction", async () => {
  let extractionCalls = 0;
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () => ({ status: "unavailable" }),
      extract: async () => {
        extractionCalls += 1;
        return SAFE_EXTRACTION_FAILURE;
      },
    }),
  );

  assert.deepEqual(await orchestrate(JOB_ID), {
    status: "job_unavailable",
    retryable: false,
  });
  assert.equal(extractionCalls, 0);
});

test("safe orchestration errors expose no raw JD or Supabase details", async () => {
  const rawMarker = "PRIVATE_RAW_JD_MARKER";
  const databaseMarker = "PRIVATE_SUPABASE_ERROR_MARKER";
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({
      getOwnedJob: async () =>
        ({
          status: "unavailable",
          error: databaseMarker,
          rawText: rawMarker,
        }) as never,
    }),
  );

  const serialized = JSON.stringify(await orchestrate(JOB_ID));

  assert.equal(serialized.includes(rawMarker), false);
  assert.equal(serialized.includes(databaseMarker), false);
  assert.equal(serialized.includes("user_id"), false);
  assert.equal(serialized.includes("source_url"), false);
});

test("passes extraction success through unchanged", async () => {
  const orchestrate = createOwnedJobExtractionOrchestrator(
    dependencies({ extract: async () => SAFE_EXTRACTION_SUCCESS }),
  );

  assert.equal(await orchestrate(JOB_ID), SAFE_EXTRACTION_SUCCESS);
});

test("passes every safe extraction failure through unchanged", async () => {
  const failures: ExtractJobDescriptionResult[] = [
    { status: "invalid_input", reason: "input_empty", retryable: false },
    {
      status: "configuration_unavailable",
      reason: "model_not_configured",
      retryable: false,
    },
    {
      status: "provider_refusal",
      reason: "provider_refusal",
      retryable: false,
    },
    {
      status: "invalid_structured_output",
      reason: "invalid_structured_output",
      retryable: false,
    },
    {
      status: "provider_unavailable",
      reason: "provider_unavailable",
      retryable: true,
    },
  ];

  for (const failure of failures) {
    const orchestrate = createOwnedJobExtractionOrchestrator(
      dependencies({ extract: async () => failure }),
    );
    assert.equal(await orchestrate(JOB_ID), failure);
  }
});
