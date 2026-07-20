import { createHash } from "node:crypto";

import { z } from "zod";

import type { DeepReadonly } from "./tailoring-provider-contracts";
import {
  TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
  TAILORING_V2_EVIDENCE_CATEGORIES,
  TAILORING_V2_PLAN_SECTION_TYPES,
  tailoringProviderInputV2Schema,
  validateTailoringPlanOutputV2,
  type TailoringPlanOutputV2,
  type TailoringProviderInputV2,
} from "./tailoring-provider-contracts-v2";

export const TAILORED_RESUME_DOCUMENT_CONTRACT_VERSION =
  "tailored-resume-document-v1" as const;

const boundedString = (maximum: number, allowEmpty = false) =>
  z.string().min(allowEmpty ? 0 : 1).max(maximum);

const provenanceSchema = z
  .object({
    entryId: boundedString(32),
    fragmentId: boundedString(32),
  })
  .strict();

const evidenceProvenanceSchema = z
  .object({ evidenceId: boundedString(32) })
  .strict();

export const tailoredResumeDocumentV1Schema = z
  .object({
    contractVersion: z.literal(TAILORED_RESUME_DOCUMENT_CONTRACT_VERSION),
    providerInputContractVersion: z.literal(
      TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
    ),
    providerPlanContractVersion: z.literal(
      TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
    ),
    sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    identity: z
      .object({
        fullName: boundedString(160, true),
        email: boundedString(320, true),
      })
      .strict(),
    education: z
      .object({
        school: boundedString(120, true),
        program: boundedString(120, true),
        gradYear: boundedString(4, true),
        coopTerm: boundedString(80, true),
      })
      .strict(),
    sections: z
      .array(
        z
          .object({
            type: z.enum(TAILORING_V2_PLAN_SECTION_TYPES),
            entries: z.array(
              z
                .object({
                  heading: boundedString(160),
                  bullets: z
                    .array(
                      z
                        .object({
                          text: boundedString(500),
                          provenance: provenanceSchema,
                        })
                        .strict(),
                    )
                    .min(1)
                    .max(20),
                })
                .strict(),
            ),
            evidence: z.array(
              z
                .object({
                  category: z.enum(TAILORING_V2_EVIDENCE_CATEGORIES),
                  term: boundedString(160),
                  languageProficiency: z
                    .enum([
                      "basic",
                      "conversational",
                      "professional",
                      "fluent",
                      "native",
                    ])
                    .optional(),
                  provenance: evidenceProvenanceSchema,
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

export type TailoredResumeDocumentV1 = DeepReadonly<
  z.infer<typeof tailoredResumeDocumentV1Schema>
>;

export type BuildTailoredResumeDocumentResult =
  | Readonly<{ status: "success"; document: TailoredResumeDocumentV1 }>
  | Readonly<{
      status: "invalid_input" | "invalid_plan" | "invalid_document";
    }>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}

export function fingerprintTailoringProviderInputV2(
  input: TailoringProviderInputV2,
) {
  const serialized = JSON.stringify(canonicalize(input));
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

export function buildTailoredResumeDocument(
  inputValue: TailoringProviderInputV2,
  planValue: TailoringPlanOutputV2,
): BuildTailoredResumeDocumentResult {
  const inputResult = tailoringProviderInputV2Schema.safeParse(inputValue);
  if (!inputResult.success) return { status: "invalid_input" };
  const planResult = validateTailoringPlanOutputV2(inputValue, planValue);
  if (planResult.status !== "valid") return { status: "invalid_plan" };

  const entryById = new Map(
    inputResult.data.entries.map((entry) => [entry.entryId, entry]),
  );
  const evidenceById = new Map(
    inputResult.data.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );

  const sections = planResult.plan.sections.map((section) => ({
    type: section.type,
    entries: section.entries.map((selection) => {
      const entry = entryById.get(selection.entryId);
      if (!entry) throw new Error("validated plan entry is unavailable");
      const fragmentById = new Map(
        entry.fragments.map((fragment) => [fragment.fragmentId, fragment]),
      );
      return {
        heading: entry.heading,
        bullets: selection.fragmentIds.map((fragmentId) => {
          const fragment = fragmentById.get(fragmentId);
          if (!fragment) throw new Error("validated plan fragment is unavailable");
          return {
            text: fragment.text,
            provenance: { entryId: entry.entryId, fragmentId },
          };
        }),
      };
    }),
    evidence: section.evidenceIds.map((evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence) throw new Error("validated plan evidence is unavailable");
      return {
        category: evidence.category,
        term: evidence.term,
        ...(evidence.languageProficiency
          ? { languageProficiency: evidence.languageProficiency }
          : {}),
        provenance: { evidenceId: evidence.evidenceId },
      };
    }),
  }));

  const candidate = {
    contractVersion: TAILORED_RESUME_DOCUMENT_CONTRACT_VERSION,
    providerInputContractVersion: TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
    providerPlanContractVersion: TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
    sourceFingerprint: fingerprintTailoringProviderInputV2(inputValue),
    identity: structuredClone(inputResult.data.identity),
    education: structuredClone(inputResult.data.education),
    sections,
  };
  const parsed = tailoredResumeDocumentV1Schema.safeParse(candidate);
  if (!parsed.success) return { status: "invalid_document" };
  return { status: "success", document: deepFreeze(parsed.data) };
}
