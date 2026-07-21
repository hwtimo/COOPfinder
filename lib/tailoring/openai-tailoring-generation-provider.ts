import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { resolveAiModel } from "@/lib/ai/model-router";
import {
  buildOpenAIProviderDiagnostic,
  reportOpenAIProviderDiagnostic,
  type OpenAIProviderDiagnostic,
} from "@/lib/ai/openai-provider-diagnostics";

import type {
  TailoringGenerationProvider,
  TailoringGenerationProviderResult,
} from "./tailoring-generation-provider";
import {
  tailoringPlanOutputV2Schema,
  tailoringProviderInputV2Schema,
  type TailoringProviderInputV2,
} from "./tailoring-provider-contracts-v2";

export const TAILORING_PLAN_STRUCTURED_OUTPUT_NAME =
  "tailoring_plan_output_v2" as const;
export const TAILORING_PROVIDER_TIMEOUT_MS = 30_000;
export const TAILORING_PROVIDER_MAX_RETRIES = 0;
// The output is reference-only and current valid fixtures are well under
// 1,000 serialized characters; 2,048 tokens leaves conservative headroom.
export const TAILORING_MAX_OUTPUT_TOKENS = 2_048;

export const TAILORING_GENERATION_PROVIDER_INSTRUCTIONS = `
Return only the strict tailoring-plan-output-v2 object. Do not return prose, markdown, HTML, explanations, diagnostics, or reasoning.
Choose and order only entryId, fragmentId, and evidenceId values present in the supplied tailoring-provider-input-v2.
Every selected entry must contain at least one approved fragmentId from that exact entry.
Never reference requirementId values; job requirements are context only.
Never invent or alter a heading, bullet, employer, role, date, duration, metric, achievement, skill, technology, certification, language, or contact detail.
Use each section type, entryId, fragmentId, and evidenceId at most once across the entire plan.
Place entries and evidence only in category-compatible sections. Omit source material rather than manufacture support.
The output is a reference-only selection plan and must contain no professional summary, rewritten bullet, arbitrary heading, sentence, or free-form claim.
`.trim();

export function buildOpenAITailoringGenerationRequest(
  model: string,
  input: TailoringProviderInputV2,
) {
  return {
    model,
    instructions: TAILORING_GENERATION_PROVIDER_INSTRUCTIONS,
    input: JSON.stringify(input),
    store: false,
    max_output_tokens: TAILORING_MAX_OUTPUT_TOKENS,
    text: {
      format: zodTextFormat(
        tailoringPlanOutputV2Schema,
        TAILORING_PLAN_STRUCTURED_OUTPUT_NAME,
      ),
    },
  } as const;
}

type TailoringOpenAIRequest = ReturnType<
  typeof buildOpenAITailoringGenerationRequest
>;

type ResponsesParseClient = {
  parse(request: TailoringOpenAIRequest): Promise<unknown>;
};

type OpenAITailoringDependencies = Readonly<{
  getLiveProviderEnabled?: () => string | undefined;
  getApiKey?: () => string | undefined;
  resolveModel?: typeof resolveAiModel;
  createClient?: (
    apiKey: string,
    options: Readonly<{ maxRetries: 0; timeout: number }>,
  ) => ResponsesParseClient;
  reportDiagnostic?: (diagnostic: OpenAIProviderDiagnostic) => void;
}>;

function defaultClientFactory(
  apiKey: string,
  options: Readonly<{ maxRetries: 0; timeout: number }>,
): ResponsesParseClient {
  const client = new OpenAI({ apiKey, ...options });
  return {
    parse(request) {
      return client.responses.parse(request);
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsRefusal(response: unknown) {
  if (!isRecord(response) || !Array.isArray(response.output)) return false;
  return response.output.some(
    (item) =>
      isRecord(item) &&
      item.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some(
        (content) => isRecord(content) && content.type === "refusal",
      ),
  );
}

function parsedOutput(response: unknown): unknown | undefined {
  return isRecord(response) && "output_parsed" in response
    ? response.output_parsed
    : undefined;
}

export function createOpenAITailoringGenerationProvider(
  dependencies: OpenAITailoringDependencies = {},
): TailoringGenerationProvider {
  return {
    async generatePlan(
      input: TailoringProviderInputV2,
    ): Promise<TailoringGenerationProviderResult> {
      const parsedInput = tailoringProviderInputV2Schema.safeParse(input);
      if (!parsedInput.success) return { status: "unavailable" };
      const liveProviderEnabled = (
        dependencies.getLiveProviderEnabled ??
        (() => process.env.OPENAI_LIVE_PROVIDER_ENABLED)
      )()?.trim();
      if (liveProviderEnabled !== "true") {
        return {
          status: "configuration_unavailable",
          reason: "live_provider_disabled",
        };
      }
      const model = (dependencies.resolveModel ?? resolveAiModel)(
        "tailoring_generation",
      );
      const apiKey = (
        dependencies.getApiKey ?? (() => process.env.OPENAI_API_KEY)
      )()?.trim();
      if (model.status !== "ready") {
        return {
          status: "configuration_unavailable",
          reason: "model_not_configured",
        };
      }
      if (!apiKey) {
        return {
          status: "configuration_unavailable",
          reason: "api_key_not_configured",
        };
      }

      try {
        const client = (dependencies.createClient ?? defaultClientFactory)(
          apiKey,
          {
            maxRetries: TAILORING_PROVIDER_MAX_RETRIES,
            timeout: TAILORING_PROVIDER_TIMEOUT_MS,
          },
        );
        const response = await client.parse(
          buildOpenAITailoringGenerationRequest(model.model, parsedInput.data),
        );
        if (containsRefusal(response)) return { status: "refusal" };
        const output = parsedOutput(response);
        return output === undefined || output === null
          ? { status: "invalid_output" }
          : { status: "output", output };
      } catch (error) {
        try {
          (dependencies.reportDiagnostic ?? reportOpenAIProviderDiagnostic)(
            buildOpenAIProviderDiagnostic("tailoring_generation", error),
          );
        } catch {
          // Diagnostics must never alter the existing fail-closed response.
        }
        return { status: "unavailable" };
      }
    },
  };
}

export const openAITailoringGenerationProvider =
  createOpenAITailoringGenerationProvider();
