export type JobExtractionProviderResult =
  | { status: "parsed"; output: unknown }
  | {
      status: "configuration_unavailable";
      reason: "api_key_not_configured";
    }
  | { status: "refusal" }
  | { status: "unavailable" };

export type JobExtractionProvider = {
  extract(input: {
    model: string;
    jobDescription: string;
  }): Promise<JobExtractionProviderResult>;
};
