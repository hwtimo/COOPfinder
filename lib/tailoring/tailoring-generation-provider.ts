import "server-only";

import type { TailoringProviderInputV2 } from "./tailoring-provider-contracts-v2";

export type TailoringGenerationProviderResult =
  | Readonly<{ status: "output"; output: unknown }>
  | Readonly<{
      status: "configuration_unavailable";
      reason:
        | "live_provider_disabled"
        | "model_not_configured"
        | "api_key_not_configured";
    }>
  | Readonly<{ status: "refusal" }>
  | Readonly<{ status: "invalid_output" }>
  | Readonly<{ status: "unavailable" }>;

export interface TailoringGenerationProvider {
  generatePlan(
    input: TailoringProviderInputV2,
  ): Promise<TailoringGenerationProviderResult>;
}
