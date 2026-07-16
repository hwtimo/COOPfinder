import assert from "node:assert/strict";
import test from "node:test";

import {
  createPrivateJobExtractionActionHandler,
  type PrivateJobExtractionActionDependencies,
  type PrivateJobExtractionActionResult,
} from "../../lib/ai/job-extraction-action-handler";

const JOB_ID = "46c24649-4b46-4ef4-8daf-49f575e6fe84";

function dependencies(
  overrides: Partial<PrivateJobExtractionActionDependencies> = {},
): PrivateJobExtractionActionDependencies {
  return {
    runBridge: async () => ({ status: "persisted" }),
    revalidatePath: () => undefined,
    ...overrides,
  };
}

test("rejects malformed job ID before bridge invocation", async () => {
  let bridgeCalls = 0;
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async () => {
        bridgeCalls += 1;
        return { status: "persisted" };
      },
    }),
  );

  assert.deepEqual(await handle("not-a-uuid"), { status: "invalid_job_id" });
  assert.equal(bridgeCalls, 0);
});

test("passes a valid private job ID unchanged", async () => {
  const receivedIds: string[] = [];
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async (jobId) => {
        receivedIds.push(jobId);
        return { status: "persisted" };
      },
    }),
  );

  await handle(JOB_ID);

  assert.deepEqual(receivedIds, [JOB_ID]);
});

test("calls the bridge exactly once", async () => {
  let bridgeCalls = 0;
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async () => {
        bridgeCalls += 1;
        return { status: "persisted" };
      },
    }),
  );

  await handle(JOB_ID);

  assert.equal(bridgeCalls, 1);
});

const directMappings: PrivateJobExtractionActionResult[] = [
  { status: "persisted" },
  { status: "already_persisted" },
  { status: "unauthenticated" },
  { status: "job_unavailable" },
  { status: "unsupported_source" },
  { status: "configuration_unavailable" },
  { status: "provider_refusal" },
  { status: "provider_unavailable" },
  { status: "invalid_structured_output" },
  { status: "invalid_job_text" },
  { status: "persistence_unavailable" },
  { status: "persistence_rejected" },
  { status: "no_credits" },
  { status: "daily_limit" },
  { status: "credit_unavailable" },
];

for (const expected of directMappings) {
  test(`maps bridge ${expected.status} safely`, async () => {
    const handle = createPrivateJobExtractionActionHandler(
      dependencies({ runBridge: async () => expected }),
    );

    assert.deepEqual(await handle(JOB_ID), expected);
  });
}

test("unknown bridge output fails closed", async () => {
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async () => ({ status: "future_internal_status" }),
    }),
  );

  assert.deepEqual(await handle(JOB_ID), {
    status: "persistence_unavailable",
  });
});

test("thrown bridge failure maps without internal details", async () => {
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async () => {
        throw new Error("PRIVATE_INTERNAL_EXCEPTION");
      },
    }),
  );

  assert.deepEqual(await handle(JOB_ID), {
    status: "provider_unavailable",
  });
});

test("failure results expose no sensitive bridge details", async () => {
  const markers = [
    "PRIVATE_RAW_JD",
    "PRIVATE_PROVIDER_PAYLOAD",
    "PRIVATE_SUPABASE_ERROR",
    "PRIVATE_CREDENTIAL",
    "PRIVATE_MODEL_ID",
    "PRIVATE_STACK_TRACE",
  ];
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async () => ({
        status: "future_internal_status",
        rawText: markers[0],
        provider: markers[1],
        databaseError: markers[2],
        credential: markers[3],
        model: markers[4],
        stack: markers[5],
      }),
    }),
  );

  const serialized = JSON.stringify(await handle(JOB_ID));
  for (const marker of markers) assert.equal(serialized.includes(marker), false);
  assert.equal(serialized.includes("stack"), false);
});

test("raw job text cannot be supplied through the handler input", async () => {
  const rawMarker = "PRIVATE_CLIENT_SUPPLIED_RAW_JD";
  const receivedIds: string[] = [];
  const handle = createPrivateJobExtractionActionHandler(
    dependencies({
      runBridge: async (jobId) => {
        receivedIds.push(jobId);
        return { status: "persisted" };
      },
    }),
  );

  await (handle as (...input: unknown[]) => Promise<unknown>)(JOB_ID, rawMarker);

  assert.equal(handle.length, 1);
  assert.deepEqual(receivedIds, [JOB_ID]);
  assert.equal(JSON.stringify(receivedIds).includes(rawMarker), false);
});

test("revalidates only the private detail path after persisted outcomes", async () => {
  for (const status of ["persisted", "already_persisted"] as const) {
    const paths: string[] = [];
    const handle = createPrivateJobExtractionActionHandler(
      dependencies({
        runBridge: async () => ({ status }),
        revalidatePath: (path) => paths.push(path),
      }),
    );

    await handle(JOB_ID);
    assert.deepEqual(paths, [`/jobs/${JOB_ID}`]);
  }
});

test("does not revalidate after any failure outcome", async () => {
  const failureStatuses = directMappings.filter(
    ({ status }) => status !== "persisted" && status !== "already_persisted",
  );

  for (const failure of failureStatuses) {
    const paths: string[] = [];
    const handle = createPrivateJobExtractionActionHandler(
      dependencies({
        runBridge: async () => failure,
        revalidatePath: (path) => paths.push(path),
      }),
    );

    await handle(JOB_ID);
    assert.deepEqual(paths, []);
  }
});
