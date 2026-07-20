import "server-only";

export const AI_TASK_CAPABILITY_TIERS = {
  job_extraction: "luna",
  tailoring_generation: "luna",
} as const;

export type AiTaskCategory = keyof typeof AI_TASK_CAPABILITY_TIERS;
export type AiCapabilityTier = (typeof AI_TASK_CAPABILITY_TIERS)[AiTaskCategory];

type ModelEnvironment = {
  OPENAI_MODEL_LUNA?: string;
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
    OPENAI_MODEL_LUNA: process.env.OPENAI_MODEL_LUNA,
  },
): AiModelResolution {
  const tier = AI_TASK_CAPABILITY_TIERS[task];
  const configuredModel =
    tier === "luna" ? environment.OPENAI_MODEL_LUNA?.trim() : undefined;

  if (!configuredModel) {
    return {
      status: "configuration_unavailable",
      reason: "model_not_configured",
    };
  }

  return { status: "ready", task, tier, model: configuredModel };
}
