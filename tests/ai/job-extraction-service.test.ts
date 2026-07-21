import assert from "node:assert/strict";
import test from "node:test";

import {
  extractJobDescription,
  PRIVATE_JOB_DESCRIPTION_MAX_LENGTH,
} from "../../lib/ai/extract-job-description";
import type {
  JobExtractionProvider,
  JobExtractionProviderResult,
} from "../../lib/ai/job-extraction-provider";
import {
  JOB_EXTRACTION_PROVIDER_INSTRUCTIONS,
  JOB_EXTRACTION_MAX_OUTPUT_TOKENS,
  JOB_EXTRACTION_PROVIDER_MAX_RETRIES,
  JOB_EXTRACTION_PROVIDER_TIMEOUT_MS,
  JOB_EXTRACTION_STRUCTURED_OUTPUT_NAME,
  createOpenAIJobExtractionProvider,
} from "../../lib/ai/openai-job-extraction-provider";
import {
  AI_TASK_CAPABILITY_TIERS,
  resolveAiModel,
  type AiModelResolution,
} from "../../lib/ai/model-router";
import { JOB_EXTRACTION_CONTRACT_VERSION } from "../../lib/ai/schemas/job-extraction";
import { jobExtractionWireV1Schema } from "../../lib/ai/schemas/job-extraction-wire";

const CONFIGURED_LUNA_MODEL = "configured-luna-model";

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
    structuredRequirements: {
      requiredSkills: ["Problem solving"],
      preferredSkills: [],
      requiredTechnologies: ["TypeScript"],
      preferredTechnologies: ["PostgreSQL"],
      education: ["Enrolled in a Canadian co-op program."],
      certifications: [],
      languages: [],
      workAuthorization: [],
      experience: [],
      responsibilities: ["Build accessible product features."],
      softSkills: [],
      keywords: ["React"],
      uncategorizedRequirements: [],
    },
    overallConfidence: 0.91,
  };
}

function readyModel(): AiModelResolution {
  return {
    status: "ready",
    task: "job_extraction",
    tier: "luna",
    model: CONFIGURED_LUNA_MODEL,
  };
}

function providerReturning(
  result: JobExtractionProviderResult,
  onCall?: (input: { model: string; jobDescription: string }) => void,
): JobExtractionProvider {
  return {
    async extract(input) {
      onCall?.(input);
      return result;
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("routes job extraction only through its task-specific environment value", () => {
  assert.equal(AI_TASK_CAPABILITY_TIERS.job_extraction, "luna");

  const resolved = resolveAiModel("job_extraction", {
    OPENAI_MODEL_JOB_EXTRACTION: `  ${CONFIGURED_LUNA_MODEL}  `,
  });
  assert.deepEqual(resolved, readyModel());

  assert.deepEqual(resolveAiModel("job_extraction", {}), {
    status: "configuration_unavailable",
    reason: "model_not_configured",
  });
  assert.deepEqual(
    resolveAiModel("job_extraction", {
      OPENAI_MODEL_JOB_EXTRACTION: "   ",
    }),
    {
      status: "configuration_unavailable",
      reason: "model_not_configured",
    },
  );
  assert.deepEqual(
    resolveAiModel("tailoring_generation", {
      OPENAI_MODEL_JOB_EXTRACTION: "extraction-model",
      OPENAI_MODEL_TAILORING: "tailoring-model",
    }),
    {
      status: "ready",
      task: "tailoring_generation",
      tier: "luna",
      model: "tailoring-model",
    },
  );
  assert.deepEqual(
    resolveAiModel("tailoring_generation", {
      OPENAI_MODEL_JOB_EXTRACTION: "extraction-model",
    }),
    {
      status: "configuration_unavailable",
      reason: "model_not_configured",
    },
  );
});

test("returns missing model configuration before provider invocation", async () => {
  let providerCalls = 0;
  const result = await extractJobDescription("Private JD", {
    resolveModel: () => ({
      status: "configuration_unavailable",
      reason: "model_not_configured",
    }),
    provider: providerReturning({ status: "parsed", output: validExtraction() }, () => {
      providerCalls += 1;
    }),
  });

  assert.deepEqual(result, {
    status: "configuration_unavailable",
    reason: "model_not_configured",
    retryable: false,
  });
  assert.equal(providerCalls, 0);
});

test("evaluates API configuration and creates the client lazily", async () => {
  let apiKeyReads = 0;
  let clientCreations = 0;
  let parseCalls = 0;
  const provider = createOpenAIJobExtractionProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey() {
      apiKeyReads += 1;
      return "test-api-key";
    },
    createClient() {
      clientCreations += 1;
      return {
        async parse() {
          parseCalls += 1;
          return { output_parsed: validExtraction(), output: [] };
        },
      };
    },
  });

  assert.equal(apiKeyReads, 0);
  assert.equal(clientCreations, 0);
  assert.equal(parseCalls, 0);

  const result = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider,
  });

  assert.equal(result.status, "success");
  assert.equal(apiKeyReads, 1);
  assert.equal(clientCreations, 1);
  assert.equal(parseCalls, 1);
});

test("returns missing API-key configuration before client or network use", async () => {
  let clientCreations = 0;
  const provider = createOpenAIJobExtractionProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "  ",
    createClient() {
      clientCreations += 1;
      throw new Error("client must not be created");
    },
  });

  const result = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider,
  });

  assert.deepEqual(result, {
    status: "configuration_unavailable",
    reason: "api_key_not_configured",
    retryable: false,
  });
  assert.equal(clientCreations, 0);
});

test("rejects invalid JD input before provider invocation", async () => {
  let providerCalls = 0;
  const provider = providerReturning(
    { status: "parsed", output: validExtraction() },
    () => {
      providerCalls += 1;
    },
  );

  const notString = await extractJobDescription({ text: "Private JD" }, {
    resolveModel: readyModel,
    provider,
  });
  const blank = await extractJobDescription("  \n\t  ", {
    resolveModel: readyModel,
    provider,
  });
  const tooLong = await extractJobDescription(
    "x".repeat(PRIVATE_JOB_DESCRIPTION_MAX_LENGTH + 1),
    { resolveModel: readyModel, provider },
  );

  assert.equal(notString.status, "invalid_input");
  assert.equal(blank.status, "invalid_input");
  assert.equal(tooLong.status, "invalid_input");
  assert.equal(providerCalls, 0);
});

test("returns canonical normalized output and classification from a fake provider", async () => {
  let receivedInput: { model: string; jobDescription: string } | undefined;
  const result = await extractJobDescription("  Private JD  ", {
    resolveModel: readyModel,
    provider: providerReturning(
      { status: "parsed", output: validExtraction() },
      (input) => {
        receivedInput = input;
      },
    ),
  });

  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.extraction.companyName.value, "Clio");
  assert.equal(result.extraction.title.value, "Software Developer Co-op");
  assert.deepEqual(result.extraction.namedSkills.value, [
    "TypeScript",
    "React",
    "PostgreSQL",
  ]);
  assert.deepEqual(result.canonicalRequirements.requiredTechnologies, [
    "TypeScript",
  ]);
  assert.deepEqual(result.canonicalRequirements.preferredTechnologies, [
    "PostgreSQL",
  ]);
  assert.deepEqual(result.canonicalRequirements.keywords, ["React"]);
  assert.deepEqual(result.canonicalRequirements.responsibilities, [
    "Build accessible product features.",
  ]);
  assert.deepEqual(result.canonicalRequirements.education, [
    "Enrolled in a Canadian co-op program.",
  ]);
  assert.deepEqual(result.canonicalRequirements.uncategorizedRequirements, []);
  assert.equal(result.reviewClassification, "normal_review");
  assert.deepEqual(receivedInput, {
    model: CONFIGURED_LUNA_MODEL,
    jobDescription: "Private JD",
  });
});

test("applies canonical validation after provider parsing", async () => {
  const impossibleDate = validExtraction();
  impossibleDate.deadline.value = "2028-02-30";
  const duplicateRequirement = validExtraction();
  duplicateRequirement.requirements.value = [
    "Experience with SQL",
    "experience   with sql",
  ];

  assert.equal(jobExtractionWireV1Schema.safeParse(impossibleDate).success, true);
  assert.equal(
    jobExtractionWireV1Schema.safeParse(duplicateRequirement).success,
    true,
  );

  for (const output of [impossibleDate, duplicateRequirement]) {
    const result = await extractJobDescription("Private JD", {
      resolveModel: readyModel,
      provider: providerReturning({ status: "parsed", output }),
    });
    assert.deepEqual(result, {
      status: "invalid_structured_output",
      reason: "invalid_structured_output",
      retryable: false,
    });
  }
});

test("rejects null or missing provider parsed output", async () => {
  for (const output of [null, undefined]) {
    const result = await extractJobDescription("Private JD", {
      resolveModel: readyModel,
      provider: providerReturning({ status: "parsed", output }),
    });
    assert.equal(result.status, "invalid_structured_output");
  }
});

test("maps provider refusal and unavailability to safe service states", async () => {
  const refused = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider: providerReturning({ status: "refusal" }),
  });
  const unavailable = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider: providerReturning({ status: "unavailable" }),
  });

  assert.deepEqual(refused, {
    status: "provider_refusal",
    reason: "provider_refusal",
    retryable: false,
  });
  assert.deepEqual(unavailable, {
    status: "provider_unavailable",
    reason: "provider_unavailable",
    retryable: true,
  });
});

test("contains an injected provider exception at the service boundary", async () => {
  const exceptionMarker = "INJECTED_PROVIDER_EXCEPTION_MARKER";
  const result = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider: {
      async extract() {
        throw new Error(exceptionMarker);
      },
    },
  });

  assert.deepEqual(result, {
    status: "provider_unavailable",
    reason: "provider_unavailable",
    retryable: true,
  });
  assert.equal(JSON.stringify(result).includes(exceptionMarker), false);
});

test("production adapter strips refusal and SDK exception details", async () => {
  const refusalMarker = "PRIVATE_REFUSAL_MARKER";
  const exceptionMarker = "PRIVATE_SDK_EXCEPTION_MARKER";
  const diagnostics: unknown[] = [];
  const refusalProvider = createOpenAIJobExtractionProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "test-api-key",
    createClient: () => ({
      async parse() {
        return {
          output_parsed: null,
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: refusalMarker }],
            },
          ],
        };
      },
    }),
  });
  const exceptionProvider = createOpenAIJobExtractionProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "test-api-key",
    createClient: () => ({
      async parse() {
        throw new Error(exceptionMarker);
      },
    }),
    reportDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    },
  });

  const refused = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider: refusalProvider,
  });
  const unavailable = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider: exceptionProvider,
  });
  const serialized = JSON.stringify({ refused, unavailable });

  assert.equal(refused.status, "provider_refusal");
  assert.equal(unavailable.status, "provider_unavailable");
  assert.equal(serialized.includes(refusalMarker), false);
  assert.equal(serialized.includes(exceptionMarker), false);
  assert.equal(serialized.includes("stack"), false);
  assert.deepEqual(diagnostics, [
    { adapter: "job_extraction", category: "unknown" },
  ]);
  assert.equal(JSON.stringify(diagnostics).includes(exceptionMarker), false);
});

test("failure results expose no raw inputs, provider payloads, or fallback data", async () => {
  const jdMarker = "PRIVATE_RAW_JD_MARKER";
  const providerMarker = "PRIVATE_PROVIDER_OUTPUT_MARKER";
  const result = await extractJobDescription(jdMarker, {
    resolveModel: readyModel,
    provider: providerReturning({
      status: "parsed",
      output: {
        companyName: "Fallback company",
        title: "Fallback title",
        requirements: [providerMarker],
        overallConfidence: 0.99,
      },
    }),
  });
  const serialized = JSON.stringify(result);

  assert.deepEqual(result, {
    status: "invalid_structured_output",
    reason: "invalid_structured_output",
    retryable: false,
  });
  assert.equal(serialized.includes(jdMarker), false);
  assert.equal(serialized.includes(providerMarker), false);
  assert.equal("companyName" in result, false);
  assert.equal("title" in result, false);
  assert.equal("requirements" in result, false);
  assert.equal("overallConfidence" in result, false);
});

test("production adapter uses routed structured Responses request without tools", async () => {
  let capturedRequest: unknown;
  let capturedOptions: unknown;
  let parseCalls = 0;
  const provider = createOpenAIJobExtractionProvider({
    getLiveProviderEnabled: () => "true",
    getApiKey: () => "test-api-key",
    createClient: (_apiKey, options) => ({
      async parse(request) {
        parseCalls += 1;
        capturedOptions = options;
        capturedRequest = request;
        return { output_parsed: validExtraction(), output: [] };
      },
    }),
  });

  const result = await extractJobDescription("Private JD", {
    resolveModel: readyModel,
    provider,
  });

  assert.equal(result.status, "success");
  assert.equal(isRecord(capturedRequest), true);
  if (!isRecord(capturedRequest)) return;
  assert.equal(capturedRequest.model, CONFIGURED_LUNA_MODEL);
  assert.equal(capturedRequest.store, false);
  assert.equal(
    capturedRequest.max_output_tokens,
    JOB_EXTRACTION_MAX_OUTPUT_TOKENS,
  );
  assert.equal(capturedRequest.input, "Private JD");
  assert.equal("tools" in capturedRequest, false);
  assert.equal("include" in capturedRequest, false);
  assert.equal("previous_response_id" in capturedRequest, false);
  assert.equal(capturedRequest.instructions, JOB_EXTRACTION_PROVIDER_INSTRUCTIONS);

  assert.equal(isRecord(capturedRequest.text), true);
  if (!isRecord(capturedRequest.text)) return;
  assert.equal(isRecord(capturedRequest.text.format), true);
  if (!isRecord(capturedRequest.text.format)) return;
  assert.equal(capturedRequest.text.format.type, "json_schema");
  assert.equal(
    capturedRequest.text.format.name,
    JOB_EXTRACTION_STRUCTURED_OUTPUT_NAME,
  );
  assert.equal(capturedRequest.text.format.strict, true);
  assert.equal(parseCalls, 1);
  assert.deepEqual(capturedOptions, {
    maxRetries: JOB_EXTRACTION_PROVIDER_MAX_RETRIES,
    timeout: JOB_EXTRACTION_PROVIDER_TIMEOUT_MS,
  });
  assert.equal(JOB_EXTRACTION_PROVIDER_MAX_RETRIES, 0);
  assert.equal(JOB_EXTRACTION_PROVIDER_TIMEOUT_MS, 30_000);
});

test("live-provider kill switch fails closed before API key or client use", async () => {
  for (const enabled of [undefined, "false", "TRUE", "1"]) {
    let apiKeyReads = 0;
    let clientCreations = 0;
    const provider = createOpenAIJobExtractionProvider({
      getLiveProviderEnabled: () => enabled,
      getApiKey() {
        apiKeyReads += 1;
        return "test-api-key";
      },
      createClient() {
        clientCreations += 1;
        throw new Error("must not create client");
      },
    });
    assert.deepEqual(await provider.extract({ model: "model", jobDescription: "JD" }), {
      status: "configuration_unavailable",
      reason: "live_provider_disabled",
    });
    assert.equal(apiKeyReads, 0);
    assert.equal(clientCreations, 0);
  }
});
