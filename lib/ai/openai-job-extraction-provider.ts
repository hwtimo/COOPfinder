import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type {
  JobExtractionProvider,
  JobExtractionProviderResult,
} from "./job-extraction-provider";
import {
  buildOpenAIProviderDiagnostic,
  reportOpenAIProviderDiagnostic,
  type OpenAIProviderDiagnostic,
} from "./openai-provider-diagnostics";
import { jobExtractionWireV1Schema } from "./schemas/job-extraction-wire";

export const JOB_EXTRACTION_STRUCTURED_OUTPUT_NAME =
  "job_extraction_v1" as const;
export const JOB_EXTRACTION_PROVIDER_TIMEOUT_MS = 60_000;
export const JOB_EXTRACTION_PROVIDER_MAX_RETRIES = 0;
// The strict extraction fixture is under 2,000 serialized characters. This
// allows substantial list growth while keeping one response below a bounded,
// cost-conscious ceiling.
export const JOB_EXTRACTION_MAX_OUTPUT_TOKENS = 4_096;

export const JOB_EXTRACTION_PROVIDER_INSTRUCTIONS = `
Extract only information explicitly stated in the supplied private job-description text.
Return only the requested structured data. Do not add prose, markdown, citations, explanations, or reasoning.
Do not invent or infer a company, job title, location, work mode, term, deadline, skill, responsibility, or requirement.
Use null for an unstated scalar field and null or an empty collection for unstated collection fields.
Populate every structuredRequirements category. Use an empty array when a category is absent.
Classify a required skill only when the text explicitly says required, mandatory, must, or places it under an explicitly required qualification heading.
Classify a preferred skill only when the text explicitly says preferred, an asset, nice to have, a bonus, or equivalent optional language.
Classify a concrete programming language, framework, library, tool, platform, database, cloud service, software product, or comparable named technology as required or preferred only when the corresponding modality is explicit.
Do not duplicate a concrete technology as a general skill unless the text independently states both concepts.
Education includes only explicit degree, enrollment, academic discipline, diploma, or academic-level conditions.
Certifications include only explicitly named certifications or credentials. Languages include only explicit human-language or proficiency requirements.
Work authorization includes only explicit work eligibility, permit, citizenship, sponsorship, or authorization conditions.
Experience includes only explicit duration, seniority, or domain-experience conditions. Responsibilities include explicit duties or actions performed in the role.
Soft skills include only explicit interpersonal or behavioral capabilities. Keywords include explicit role or domain terms useful for matching that are not represented in a more precise category.
Place an explicit qualification that cannot be safely assigned elsewhere in uncategorizedRequirements. Never promote ambiguous language to required.
Avoid duplicating the same requirement across categories, preserve first-seen meaning and practical source order, and never invent an unstated qualification.
A statement inside a responsibilities section remains a responsibility unless the text independently and explicitly presents it as a candidate qualification.
Use only Remote, Hybrid, or On-site when work mode is explicit; otherwise use null.
Treat a deadline as present only when the text explicitly states a real calendar deadline. Do not derive it from posting dates, start dates, durations, or vague phrases.
Set each confidence value only from how explicitly that field appears in the supplied text. Overall confidence must reflect the extraction as a whole.
Do not provide eligibility judgments, hiring outcomes, resume content, candidate matching, application advice, or public-board content.
The supplied text remains private input and must not be transformed into a public job-board summary.
`.trim();

export function buildOpenAIJobExtractionRequest(
  model: string,
  jobDescription: string,
) {
  return {
    model,
    instructions: JOB_EXTRACTION_PROVIDER_INSTRUCTIONS,
    input: jobDescription,
    store: false,
    max_output_tokens: JOB_EXTRACTION_MAX_OUTPUT_TOKENS,
    text: {
      format: zodTextFormat(
        jobExtractionWireV1Schema,
        JOB_EXTRACTION_STRUCTURED_OUTPUT_NAME,
      ),
    },
  } as const;
}

type OpenAIJobExtractionRequest = ReturnType<
  typeof buildOpenAIJobExtractionRequest
>;

type ResponsesParseClient = {
  parse(request: OpenAIJobExtractionRequest): Promise<unknown>;
};

type OpenAIProviderDependencies = {
  getLiveProviderEnabled?: () => string | undefined;
  getApiKey?: () => string | undefined;
  createClient?: (
    apiKey: string,
    options: Readonly<{ maxRetries: 0; timeout: number }>,
  ) => ResponsesParseClient;
  reportDiagnostic?: (diagnostic: OpenAIProviderDiagnostic) => void;
};

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

function parsedOutput(response: unknown) {
  if (!isRecord(response) || !("output_parsed" in response)) return null;
  return response.output_parsed;
}

export function createOpenAIJobExtractionProvider(
  dependencies: OpenAIProviderDependencies = {},
): JobExtractionProvider {
  return {
    async extract({
      model,
      jobDescription,
    }): Promise<JobExtractionProviderResult> {
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

      const getApiKey =
        dependencies.getApiKey ?? (() => process.env.OPENAI_API_KEY);
      const apiKey = getApiKey()?.trim();

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
            maxRetries: JOB_EXTRACTION_PROVIDER_MAX_RETRIES,
            timeout: JOB_EXTRACTION_PROVIDER_TIMEOUT_MS,
          },
        );
        const response = await client.parse(
          buildOpenAIJobExtractionRequest(model, jobDescription),
        );

        if (containsRefusal(response)) return { status: "refusal" };
        return { status: "parsed", output: parsedOutput(response) };
      } catch (error) {
        try {
          (dependencies.reportDiagnostic ?? reportOpenAIProviderDiagnostic)(
            buildOpenAIProviderDiagnostic("job_extraction", error),
          );
        } catch {
          // Diagnostics must never alter the existing fail-closed response.
        }
        return { status: "unavailable" };
      }
    },
  };
}

export const openAIJobExtractionProvider =
  createOpenAIJobExtractionProvider();
