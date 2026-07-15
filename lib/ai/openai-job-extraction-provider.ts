import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type {
  JobExtractionProvider,
  JobExtractionProviderResult,
} from "./job-extraction-provider";
import { jobExtractionWireV1Schema } from "./schemas/job-extraction-wire";

export const JOB_EXTRACTION_STRUCTURED_OUTPUT_NAME =
  "job_extraction_v1" as const;

export const JOB_EXTRACTION_PROVIDER_INSTRUCTIONS = `
Extract only information explicitly stated in the supplied private job-description text.
Return only the requested structured data. Do not add prose, markdown, citations, explanations, or reasoning.
Do not invent or infer a company, job title, location, work mode, term, deadline, skill, responsibility, or requirement.
Use null for an unstated scalar field and null or an empty collection for unstated collection fields.
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
  getApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ResponsesParseClient;
};

function defaultClientFactory(apiKey: string): ResponsesParseClient {
  const client = new OpenAI({ apiKey });
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
        );
        const response = await client.parse(
          buildOpenAIJobExtractionRequest(model, jobDescription),
        );

        if (containsRefusal(response)) return { status: "refusal" };
        return { status: "parsed", output: parsedOutput(response) };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export const openAIJobExtractionProvider =
  createOpenAIJobExtractionProvider();
