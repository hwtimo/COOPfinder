import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { resolveAiModel } from "@/lib/ai/model-router";
import {
  buildOpenAIProviderDiagnostic,
  reportOpenAIProviderDiagnostic,
  type OpenAIProviderDiagnostic,
} from "@/lib/ai/openai-provider-diagnostics";

import {
  RESUME_PROFILE_DRAFT_CONTRACT_VERSION,
  resumeProfileDraftOutputV1Schema,
} from "./resume-profile-draft-contract";
import type {
  ResumeProfileDraftProvider,
  ResumeProfileDraftProviderResult,
} from "./resume-profile-draft-provider";

export const RESUME_PROFILE_DRAFT_STRUCTURED_OUTPUT_NAME =
  "resume_profile_draft_v1" as const;
export const RESUME_PROFILE_DRAFT_PROVIDER_TIMEOUT_MS = 30_000;
export const RESUME_PROFILE_DRAFT_PROVIDER_MAX_RETRIES = 0;
// The response contains verbatim resume excerpts and short skill labels.
// Current two-page resume fixtures serialize below 2,000 tokens; 4,096 leaves
// bounded room for a longer resume without approaching the model output window.
export const RESUME_PROFILE_DRAFT_MAX_OUTPUT_TOKENS = 4_096;

export const RESUME_PROFILE_DRAFT_PROVIDER_INSTRUCTIONS = `
Return only the strict ${RESUME_PROFILE_DRAFT_CONTRACT_VERSION} object. Do not return prose, markdown, explanations, diagnostics, or reasoning.
Use only facts explicitly present in the supplied extracted resume text.
For education, workExperience, projects, and leadershipActivities, copy each text value verbatim from one contiguous passage in the supplied resume. Do not rewrite, summarize, combine, correct, or embellish it.
Include a skill only when its exact words appear in the supplied resume text. Preserve the resume's spelling.
Never invent or infer an employer, role, date, skill, project, metric, achievement, credential, responsibility, or leadership activity.
Use an empty array when a category is absent or cannot be copied safely.
Do not include confirmation state, identifiers, contact details, model commentary, confidence, or source metadata.
The result is an unconfirmed draft requiring user review and is not approval to persist any evidence.
`.trim();

export function buildOpenAIResumeProfileDraftRequest(
  model: string,
  extractedResumeText: string,
) {
  return {
    model,
    instructions: RESUME_PROFILE_DRAFT_PROVIDER_INSTRUCTIONS,
    input: extractedResumeText,
    store: false,
    max_output_tokens: RESUME_PROFILE_DRAFT_MAX_OUTPUT_TOKENS,
    text: {
      format: zodTextFormat(
        resumeProfileDraftOutputV1Schema,
        RESUME_PROFILE_DRAFT_STRUCTURED_OUTPUT_NAME,
      ),
    },
  } as const;
}

type OpenAIResumeProfileDraftRequest = ReturnType<
  typeof buildOpenAIResumeProfileDraftRequest
>;

type ResponsesParseClient = {
  parse(request: OpenAIResumeProfileDraftRequest): Promise<unknown>;
};

type Dependencies = Readonly<{
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

export function createOpenAIResumeProfileDraftProvider(
  dependencies: Dependencies = {},
): ResumeProfileDraftProvider {
  return {
    async generateDraft(
      extractedResumeText,
    ): Promise<ResumeProfileDraftProviderResult> {
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
        "resume_profile_drafting",
      );
      if (model.status !== "ready") {
        return {
          status: "configuration_unavailable",
          reason: "model_not_configured",
        };
      }

      const apiKey = (
        dependencies.getApiKey ?? (() => process.env.OPENAI_API_KEY)
      )()?.trim();
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
            maxRetries: RESUME_PROFILE_DRAFT_PROVIDER_MAX_RETRIES,
            timeout: RESUME_PROFILE_DRAFT_PROVIDER_TIMEOUT_MS,
          },
        );
        const response = await client.parse(
          buildOpenAIResumeProfileDraftRequest(
            model.model,
            extractedResumeText,
          ),
        );
        if (containsRefusal(response)) return { status: "refusal" };
        const parsed = resumeProfileDraftOutputV1Schema.safeParse(
          parsedOutput(response),
        );
        return parsed.success
          ? { status: "output", output: parsed.data }
          : { status: "invalid_output" };
      } catch (error) {
        try {
          (dependencies.reportDiagnostic ?? reportOpenAIProviderDiagnostic)(
            buildOpenAIProviderDiagnostic("resume_profile_drafting", error),
          );
        } catch {
          // Diagnostics must never alter the fail-closed result.
        }
        return { status: "unavailable" };
      }
    },
  };
}

export const openAIResumeProfileDraftProvider =
  createOpenAIResumeProfileDraftProvider();
