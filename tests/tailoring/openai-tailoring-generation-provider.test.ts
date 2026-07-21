import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildOpenAITailoringGenerationRequest,
  createOpenAITailoringGenerationProvider,
  TAILORING_GENERATION_PROVIDER_INSTRUCTIONS,
  TAILORING_PROVIDER_MAX_RETRIES,
  TAILORING_PROVIDER_TIMEOUT_MS,
  TAILORING_MAX_OUTPUT_TOKENS,
} from "../../lib/tailoring/openai-tailoring-generation-provider";
import { buildTailoringProviderInputV2 } from "../../lib/tailoring/build-tailoring-provider-input-v2";
import type { TailoringProviderInputV2 } from "../../lib/tailoring/tailoring-provider-contracts-v2";
import {
  readyPreflightV2,
  resumeSourceSnapshotV2,
  validTailoringPlanV2,
} from "./tailoring-v2-fixtures";

function input(): TailoringProviderInputV2 {
  const result = buildTailoringProviderInputV2(
    readyPreflightV2(),
    resumeSourceSnapshotV2(),
  );
  assert.equal(result.status, "success");
  if (result.status !== "success") throw new Error("expected v2 input");
  return result.input;
}

const readyModel = () => ({
  status: "ready" as const,
  task: "tailoring_generation" as const,
  tier: "luna" as const,
  model: "configured-model",
});

test("builds one strict reference-only Responses request", () => {
  const request = buildOpenAITailoringGenerationRequest(
    "configured-model",
    input(),
  );
  assert.equal(request.model, "configured-model");
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, TAILORING_MAX_OUTPUT_TOKENS);
  assert.equal("tools" in request, false);
  assert.equal("stream" in request, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.match(request.input, /tailoring-provider-input-v2/);
  assert.match(TAILORING_GENERATION_PROVIDER_INSTRUCTIONS, /entryId, fragmentId, and evidenceId/i);
  assert.match(TAILORING_GENERATION_PROVIDER_INSTRUCTIONS, /Never reference requirementId/);
  assert.match(TAILORING_GENERATION_PROVIDER_INSTRUCTIONS, /no professional summary/i);
});

test("uses maxRetries zero, a bounded timeout, and exactly one parse request", async () => {
  let requests = 0;
  let capturedOptions: unknown;
  const provider = createOpenAITailoringGenerationProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient(_apiKey, options) {
      capturedOptions = options;
      return {
        async parse() {
          requests += 1;
          return {
            output_parsed: validTailoringPlanV2(),
          };
        },
      };
    },
  });
  assert.equal((await provider.generatePlan(input())).status, "output");
  assert.equal(requests, 1);
  assert.deepEqual(capturedOptions, {
    maxRetries: TAILORING_PROVIDER_MAX_RETRIES,
    timeout: TAILORING_PROVIDER_TIMEOUT_MS,
  });
  assert.equal(TAILORING_PROVIDER_MAX_RETRIES, 0);
  assert.ok(TAILORING_PROVIDER_TIMEOUT_MS > 0);
  assert.ok(TAILORING_PROVIDER_TIMEOUT_MS <= 60_000);
});

test("maps refusal, malformed output, and thrown transport failures safely", async () => {
  const responses = [
    {
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "no" }] },
      ],
    },
    {},
  ];
  let index = 0;
  const provider = createOpenAITailoringGenerationProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient() {
      return { async parse() { return responses[index++]; } };
    },
  });
  assert.deepEqual(await provider.generatePlan(input()), { status: "refusal" });
  assert.deepEqual(await provider.generatePlan(input()), {
    status: "invalid_output",
  });

  const unavailable = createOpenAITailoringGenerationProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient() {
      return { async parse() { throw new Error("private transport detail"); } };
    },
  });
  assert.deepEqual(await unavailable.generatePlan(input()), {
    status: "unavailable",
  });
});

test("live-provider kill switch fails closed before model, key, or client use", async () => {
  for (const enabled of [undefined, "false", "TRUE", "1"]) {
    let modelReads = 0;
    let keyReads = 0;
    let clientCreations = 0;
    const provider = createOpenAITailoringGenerationProvider({
      getLiveProviderEnabled: () => enabled,
      resolveModel() {
        modelReads += 1;
        return readyModel();
      },
      getApiKey() {
        keyReads += 1;
        return "configured-key";
      },
      createClient() {
        clientCreations += 1;
        throw new Error("must not create client");
      },
    });
    assert.deepEqual(await provider.generatePlan(input()), {
      status: "configuration_unavailable",
      reason: "live_provider_disabled",
    });
    assert.equal(modelReads, 0);
    assert.equal(keyReads, 0);
    assert.equal(clientCreations, 0);
  }
});

test("task model and API key configuration fail safely without a request", async () => {
  let clientCreations = 0;
  const createClient = () => {
    clientCreations += 1;
    throw new Error("must not create client");
  };
  const missingModel = createOpenAITailoringGenerationProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: () => ({
      status: "configuration_unavailable",
      reason: "model_not_configured",
    }),
    createClient,
  });
  const missingKey = createOpenAITailoringGenerationProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => " ",
    resolveModel: readyModel,
    createClient,
  });
  assert.deepEqual(await missingModel.generatePlan(input()), {
    status: "configuration_unavailable",
    reason: "model_not_configured",
  });
  assert.deepEqual(await missingKey.generatePlan(input()), {
    status: "configuration_unavailable",
    reason: "api_key_not_configured",
  });
  assert.equal(clientCreations, 0);
});

test("adapter is server-only and contains no repair, fallback, route, or UI dependency", () => {
  const source = readFileSync(
    "lib/tailoring/openai-tailoring-generation-provider.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.equal((source.match(/client\.parse\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /fallback|repair|stream:\s*true|tools:/i);
  assert.doesNotMatch(source, /app\/|components\/|rawProfile|rawJob/);
});
