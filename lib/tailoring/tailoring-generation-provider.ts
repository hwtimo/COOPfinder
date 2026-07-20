import "server-only";

import type { TailoringProviderInputV2 } from "./tailoring-provider-contracts-v2";

export type TailoringGenerationProviderResult =
  | Readonly<{ status: "output"; output: unknown }>
  | Readonly<{ status: "refusal" }>
  | Readonly<{ status: "invalid_output" }>
  | Readonly<{ status: "unavailable" }>;

export interface TailoringGenerationProvider {
  generatePlan(
    input: TailoringProviderInputV2,
  ): Promise<TailoringGenerationProviderResult>;
}
