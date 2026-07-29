import type { ResumeProfileDraftOutputV1 } from "./resume-profile-draft-contract";

export type ResumeProfileDraftProviderResult =
  | { status: "output"; output: ResumeProfileDraftOutputV1 }
  | {
      status: "configuration_unavailable";
      reason:
        | "live_provider_disabled"
        | "model_not_configured"
        | "api_key_not_configured";
    }
  | { status: "refusal" }
  | { status: "invalid_output" }
  | { status: "unavailable" };

export type ResumeProfileDraftProvider = {
  generateDraft(extractedResumeText: string): Promise<ResumeProfileDraftProviderResult>;
};
