import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildOpenAIResumeProfileDraftRequest,
  createOpenAIResumeProfileDraftProvider,
  RESUME_PROFILE_DRAFT_MAX_OUTPUT_TOKENS,
  RESUME_PROFILE_DRAFT_PROVIDER_INSTRUCTIONS,
  RESUME_PROFILE_DRAFT_PROVIDER_MAX_RETRIES,
  RESUME_PROFILE_DRAFT_PROVIDER_TIMEOUT_MS,
} from "../../lib/resumes/openai-resume-profile-draft-provider";
import { RESUME_PROFILE_DRAFT_CONTRACT_VERSION } from "../../lib/resumes/resume-profile-draft-contract";
import {
  AI_TASK_CAPABILITY_TIERS,
  resolveAiModel,
} from "../../lib/ai/model-router";

const INPUT = "React developer. Built accessible interfaces.";

function output() {
  return {
    contractVersion: RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
    education: [],
    skills: ["React"],
    workExperience: [
      { text: "Built accessible interfaces.", skills: [] },
    ],
    projects: [],
    leadershipActivities: [],
  };
}

const readyModel = () => ({
  status: "ready" as const,
  task: "resume_profile_drafting" as const,
  tier: "luna" as const,
  model: "configured-draft-model",
});

test("uses its centralized task-specific model without a fallback", () => {
  assert.equal(AI_TASK_CAPABILITY_TIERS.resume_profile_drafting, "luna");
  assert.deepEqual(
    resolveAiModel("resume_profile_drafting", {
      OPENAI_MODEL_JOB_EXTRACTION: "job-model",
      OPENAI_MODEL_RESUME_PROFILE_DRAFTING: " draft-model ",
      OPENAI_MODEL_TAILORING: "tailoring-model",
    }),
    {
      status: "ready",
      task: "resume_profile_drafting",
      tier: "luna",
      model: "draft-model",
    },
  );
  assert.deepEqual(resolveAiModel("resume_profile_drafting", {}), {
    status: "configuration_unavailable",
    reason: "model_not_configured",
  });
});

test("builds one bounded strict Responses request with only extracted text", () => {
  const request = buildOpenAIResumeProfileDraftRequest(
    "configured-draft-model",
    INPUT,
  );
  assert.equal(request.model, "configured-draft-model");
  assert.equal(request.input, INPUT);
  assert.equal(request.store, false);
  assert.equal(
    request.max_output_tokens,
    RESUME_PROFILE_DRAFT_MAX_OUTPUT_TOKENS,
  );
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal("tools" in request, false);
  assert.equal("stream" in request, false);
  assert.match(RESUME_PROFILE_DRAFT_PROVIDER_INSTRUCTIONS, /verbatim/i);
  assert.match(RESUME_PROFILE_DRAFT_PROVIDER_INSTRUCTIONS, /Never invent/i);
  assert.match(RESUME_PROFILE_DRAFT_PROVIDER_INSTRUCTIONS, /unconfirmed draft/i);
});

test("uses zero retries, bounded timeout, and exactly one provider request", async () => {
  let requests = 0;
  let options: unknown;
  const provider = createOpenAIResumeProfileDraftProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient(_apiKey, clientOptions) {
      options = clientOptions;
      return {
        async parse() {
          requests += 1;
          return { output_parsed: output() };
        },
      };
    },
  });

  assert.deepEqual(await provider.generateDraft(INPUT), {
    status: "output",
    output: output(),
  });
  assert.equal(requests, 1);
  assert.deepEqual(options, {
    maxRetries: RESUME_PROFILE_DRAFT_PROVIDER_MAX_RETRIES,
    timeout: RESUME_PROFILE_DRAFT_PROVIDER_TIMEOUT_MS,
  });
  assert.equal(RESUME_PROFILE_DRAFT_PROVIDER_MAX_RETRIES, 0);
  assert.equal(RESUME_PROFILE_DRAFT_PROVIDER_TIMEOUT_MS, 30_000);
});

test("kill switch and missing configuration fail before client creation", async () => {
  let clientCreations = 0;
  const createClient = () => {
    clientCreations += 1;
    throw new Error("must not create client");
  };
  const disabled = createOpenAIResumeProfileDraftProvider({
    getLiveProviderEnabled: () => "false",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient,
  });
  assert.deepEqual(await disabled.generateDraft(INPUT), {
    status: "configuration_unavailable",
    reason: "live_provider_disabled",
  });

  const noModel = createOpenAIResumeProfileDraftProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: () => ({
      status: "configuration_unavailable",
      reason: "model_not_configured",
    }),
    createClient,
  });
  assert.deepEqual(await noModel.generateDraft(INPUT), {
    status: "configuration_unavailable",
    reason: "model_not_configured",
  });
  assert.equal(clientCreations, 0);
});

test("refusal, malformed output, and transport errors remain sanitized", async () => {
  const responses = [
    {
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "private" }] },
      ],
    },
    { output_parsed: { ...output(), confirmed: true } },
  ];
  let index = 0;
  const provider = createOpenAIResumeProfileDraftProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient: () => ({
      async parse() {
        return responses[index++];
      },
    }),
  });
  assert.deepEqual(await provider.generateDraft(INPUT), { status: "refusal" });
  assert.deepEqual(await provider.generateDraft(INPUT), {
    status: "invalid_output",
  });

  const diagnostics: unknown[] = [];
  const unavailable = createOpenAIResumeProfileDraftProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "configured-key",
    resolveModel: readyModel,
    createClient: () => ({
      async parse() {
        throw new Error("email@example.com resume body secret token");
      },
    }),
    reportDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    },
  });
  assert.deepEqual(await unavailable.generateDraft(INPUT), {
    status: "unavailable",
  });
  assert.deepEqual(diagnostics, [
    { adapter: "resume_profile_drafting", category: "unknown" },
  ]);
  assert.doesNotMatch(
    JSON.stringify(diagnostics),
    /email@example\.com|resume body|secret token/i,
  );
});

test("adapter is server-only with no repair, fallback, credits, or persistence", () => {
  const source = readFileSync(
    "lib/resumes/openai-resume-profile-draft-provider.ts",
    "utf8",
  );
  assert.match(source, /^import "server-only";/);
  assert.equal((source.match(/client\.parse\(/g) ?? []).length, 1);
  assert.doesNotMatch(
    source,
    /repair|fallback|\.from\(|\.rpc\(|insert\(|update\(|reservation|credit/i,
  );
});
