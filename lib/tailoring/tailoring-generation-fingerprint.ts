import "server-only";

import { createHash } from "node:crypto";

import {
  TAILORING_PROVIDER_INPUT_CONTRACT_VERSION,
  tailoringProviderInputV1Schema,
  type TailoringProviderInputV1,
} from "./tailoring-provider-contracts";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en-CA"))
      .map(([key, nested]) => [key, canonicalValue(nested)]),
  );
}

export function canonicalizeTailoringProviderInput(
  input: TailoringProviderInputV1,
): string {
  const parsed = tailoringProviderInputV1Schema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid tailoring provider input");
  return JSON.stringify(canonicalValue(parsed.data));
}

export function fingerprintTailoringProviderInput(
  input: TailoringProviderInputV1,
): string {
  const serialized = canonicalizeTailoringProviderInput(input);
  return createHash("sha256")
    .update(`${TAILORING_PROVIDER_INPUT_CONTRACT_VERSION}\n${serialized}`, "utf8")
    .digest("hex");
}
