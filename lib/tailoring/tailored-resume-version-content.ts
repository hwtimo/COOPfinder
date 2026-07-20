import { z } from "zod";

import type { DeepReadonly } from "./tailoring-provider-contracts";
import {
  TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
  TAILORING_V2_EVIDENCE_CATEGORIES,
  TAILORING_V2_PLAN_SECTION_TYPES,
  tailoringPlanOutputV2Schema,
  tailoringProviderInputV2Schema,
  validateTailoringPlanOutputV2,
  type TailoringPlanOutputV2,
  type TailoringProviderInputV2,
} from "./tailoring-provider-contracts-v2";
import {
  tailoredResumeDocumentV1Schema,
  type TailoredResumeDocumentV1,
} from "./tailored-resume-document";

export const TAILORED_RESUME_VERSION_CONTENT_CONTRACT_VERSION =
  "tailored-resume-version-content-v2" as const;

const normalizedString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.replace(/\s+/g, " ").trim() === value);

const selectedFragmentSchema = z
  .object({
    entryId: normalizedString(32),
    fragmentId: normalizedString(32),
    heading: normalizedString(160),
    text: normalizedString(500),
    provenance: z.literal("manual"),
  })
  .strict();

const selectedEvidenceSchema = z
  .object({
    evidenceId: normalizedString(32),
    category: z.enum(TAILORING_V2_EVIDENCE_CATEGORIES),
    term: normalizedString(160),
    languageProficiency: z
      .enum(["basic", "conversational", "professional", "fluent", "native"])
      .optional(),
  })
  .strict();

export const tailoredResumeVersionContentV2Schema = z
  .object({
    contractVersion: z.literal(
      TAILORED_RESUME_VERSION_CONTENT_CONTRACT_VERSION,
    ),
    providerInputContractVersion: z.literal(
      TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
    ),
    providerOutputContractVersion: z.literal(
      TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
    ),
    sourceFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    job: z
      .object({
        title: normalizedString(200),
        companyName: normalizedString(160),
        location: normalizedString(160).optional(),
      })
      .strict(),
    plan: tailoringPlanOutputV2Schema,
    document: tailoredResumeDocumentV1Schema,
    selectedSources: z
      .object({
        fragments: z.array(selectedFragmentSchema).max(2_000),
        evidence: z.array(selectedEvidenceSchema).max(300),
      })
      .strict(),
  })
  .strict()
  .superRefine((content, context) => {
    if (
      content.document.sourceFingerprint !== content.sourceFingerprint ||
      content.document.providerInputContractVersion !==
        content.providerInputContractVersion ||
      content.document.providerPlanContractVersion !==
        content.providerOutputContractVersion
    ) {
      context.addIssue({
        code: "custom",
        message: "Document lineage does not match the envelope",
        path: ["document"],
      });
    }

    const documentFragments = content.document.sections.flatMap((section) =>
      section.entries.flatMap((entry) =>
        entry.bullets.map((bullet) => ({
          entryId: bullet.provenance.entryId,
          fragmentId: bullet.provenance.fragmentId,
          heading: entry.heading,
          text: bullet.text,
          provenance: "manual" as const,
        })),
      ),
    );
    const documentEvidence = content.document.sections.flatMap((section) =>
      section.evidence.map((evidence) => ({
        evidenceId: evidence.provenance.evidenceId,
        category: evidence.category,
        term: evidence.term,
        ...(evidence.languageProficiency
          ? { languageProficiency: evidence.languageProficiency }
          : {}),
      })),
    );
    if (
      JSON.stringify(documentFragments) !==
        JSON.stringify(content.selectedSources.fragments) ||
      JSON.stringify(documentEvidence) !==
        JSON.stringify(content.selectedSources.evidence)
    ) {
      context.addIssue({
        code: "custom",
        message: "Selected source snapshot does not match the document",
        path: ["selectedSources"],
      });
    }
  });

export type TailoredResumeVersionContentV2 = DeepReadonly<
  z.infer<typeof tailoredResumeVersionContentV2Schema>
>;

export type BuildTailoredResumeVersionContentResult =
  | Readonly<{
      status: "success";
      content: TailoredResumeVersionContentV2;
    }>
  | Readonly<{ status: "invalid" }>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value) as DeepReadonly<T>;
}

export function buildTailoredResumeVersionContent(
  inputValue: TailoringProviderInputV2,
  planValue: TailoringPlanOutputV2,
  documentValue: TailoredResumeDocumentV1,
  sourceFingerprint: string,
): BuildTailoredResumeVersionContentResult {
  const input = tailoringProviderInputV2Schema.safeParse(inputValue);
  const plan = validateTailoringPlanOutputV2(inputValue, planValue);
  const document = tailoredResumeDocumentV1Schema.safeParse(documentValue);
  if (
    !input.success ||
    plan.status !== "valid" ||
    !document.success ||
    document.data.sourceFingerprint !== sourceFingerprint
  ) {
    return { status: "invalid" };
  }

  const fragments = document.data.sections.flatMap((section) =>
    section.entries.flatMap((entry) =>
      entry.bullets.map((bullet) => ({
        entryId: bullet.provenance.entryId,
        fragmentId: bullet.provenance.fragmentId,
        heading: entry.heading,
        text: bullet.text,
        provenance: "manual" as const,
      })),
    ),
  );
  const evidence = document.data.sections.flatMap((section) =>
    section.evidence.map((item) => ({
      evidenceId: item.provenance.evidenceId,
      category: item.category,
      term: item.term,
      ...(item.languageProficiency
        ? { languageProficiency: item.languageProficiency }
        : {}),
    })),
  );
  const candidate = {
    contractVersion: TAILORED_RESUME_VERSION_CONTENT_CONTRACT_VERSION,
    providerInputContractVersion: TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
    providerOutputContractVersion: TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
    sourceFingerprint,
    job: structuredClone(input.data.job),
    plan: structuredClone(plan.plan),
    document: structuredClone(document.data),
    selectedSources: { fragments, evidence },
  };
  const parsed = tailoredResumeVersionContentV2Schema.safeParse(candidate);
  return parsed.success
    ? { status: "success", content: deepFreeze(parsed.data) }
    : { status: "invalid" };
}

export type ParseTailoredResumeVersionContentResult =
  | Readonly<{ status: "valid"; content: TailoredResumeVersionContentV2 }>
  | Readonly<{ status: "invalid" }>;

export function parseTailoredResumeVersionContent(
  value: unknown,
): ParseTailoredResumeVersionContentResult {
  const parsed = tailoredResumeVersionContentV2Schema.safeParse(value);
  return parsed.success
    ? { status: "valid", content: deepFreeze(parsed.data) }
    : { status: "invalid" };
}

export type TailoredResumeDocumentReviewViewModel = Readonly<{
  identity: Readonly<{ fullName: string; email: string }>;
  education: Readonly<{
    school: string;
    program: string;
    gradYear: string;
    coopTerm: string;
  }>;
  sections: readonly Readonly<{
    type: (typeof TAILORING_V2_PLAN_SECTION_TYPES)[number];
    entries: readonly Readonly<{
      heading: string;
      bullets: readonly Readonly<{
        text: string;
        entryId: string;
        fragmentId: string;
      }>[];
    }>[];
    evidence: readonly Readonly<{
      category: (typeof TAILORING_V2_EVIDENCE_CATEGORIES)[number];
      term: string;
      evidenceId: string;
      languageProficiency?:
        | "basic"
        | "conversational"
        | "professional"
        | "fluent"
        | "native";
    }>[];
  }>[];
}>;

export function buildTailoredResumeDocumentReviewViewModel(
  content: TailoredResumeVersionContentV2,
): TailoredResumeDocumentReviewViewModel {
  return {
    identity: { ...content.document.identity },
    education: { ...content.document.education },
    sections: content.document.sections.map((section) => ({
      type: section.type,
      entries: section.entries.map((entry) => ({
        heading: entry.heading,
        bullets: entry.bullets.map((bullet) => ({
          text: bullet.text,
          entryId: bullet.provenance.entryId,
          fragmentId: bullet.provenance.fragmentId,
        })),
      })),
      evidence: section.evidence.map((item) => ({
        category: item.category,
        term: item.term,
        evidenceId: item.provenance.evidenceId,
        ...(item.languageProficiency
          ? { languageProficiency: item.languageProficiency }
          : {}),
      })),
    })),
  };
}
