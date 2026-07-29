import "server-only";

export const AI_TASK_CAPABILITY_TIERS = {
  job_extraction: "luna",
  resume_profile_drafting: "luna",
  tailoring_generation: "luna",
} as const;

export type AiTaskCategory = keyof typeof AI_TASK_CAPABILITY_TIERS;
export type AiCapabilityTier = (typeof AI_TASK_CAPABILITY_TIERS)[AiTaskCategory];

type ModelEnvironment = {
  OPENAI_MODEL_JOB_EXTRACTION?: string;
  OPENAI_MODEL_RESUME_PROFILE_DRAFTING?: string;
  OPENAI_MODEL_TAILORING?: string;
};

export type AiModelResolution =
  | {
      status: "ready";
      task: AiTaskCategory;
      tier: AiCapabilityTier;
      model: string;
    }
  | {
      status: "configuration_unavailable";
      reason: "model_not_configured";
    };

export function resolveAiModel(
  task: AiTaskCategory,
  environment: ModelEnvironment = {
    OPENAI_MODEL_JOB_EXTRACTION: process.env.OPENAI_MODEL_JOB_EXTRACTION,
    OPENAI_MODEL_RESUME_PROFILE_DRAFTING:
      process.env.OPENAI_MODEL_RESUME_PROFILE_DRAFTING,
    OPENAI_MODEL_TAILORING: process.env.OPENAI_MODEL_TAILORING,
  },
): AiModelResolution {
  const tier = AI_TASK_CAPABILITY_TIERS[task];
  const configuredModel = {
    job_extraction: environment.OPENAI_MODEL_JOB_EXTRACTION,
    resume_profile_drafting:
      environment.OPENAI_MODEL_RESUME_PROFILE_DRAFTING,
    tailoring_generation: environment.OPENAI_MODEL_TAILORING,
  }[task]?.trim();

  if (!configuredModel) {
    return {
      status: "configuration_unavailable",
      reason: "model_not_configured",
    };
  }

  return { status: "ready", task, tier, model: configuredModel };
}
