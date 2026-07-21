import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseUser } from "@/lib/supabase/user";

import { buildTailoringProviderInputV2 } from "./build-tailoring-provider-input-v2";
import {
  getOwnedTailoringGenerationSource,
  type OwnedTailoringGenerationSourceResult,
} from "./get-owned-tailoring-generation-source";
import { openAITailoringGenerationProvider } from "./openai-tailoring-generation-provider";
import {
  buildTailoredResumeDocument,
  fingerprintTailoringProviderInputV2,
} from "./tailored-resume-document";
import {
  buildTailoredResumeVersionContent,
  type TailoredResumeVersionContentV2,
} from "./tailored-resume-version-content";
import type { TailoringGenerationProvider } from "./tailoring-generation-provider";
import {
  parseTailoringFinalizationRpcResult,
  parseTailoringRefundRpcResult,
  parseTailoringReservationRpcResult,
  type TailoringFinalizationRpcResult,
  type TailoringReservationRpcResult,
} from "./tailoring-generation-reservation";
import {
  TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
  TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
  validateTailoringPlanOutputV2,
  type TailoringProviderInputV2,
  type ValidateTailoringPlanV2Result,
} from "./tailoring-provider-contracts-v2";

type TrustedTailoringRpcName =
  | "reserve_tailoring_generation_credit_trusted"
  | "refund_tailoring_generation_reservation_trusted"
  | "finalize_tailored_resume_document_trusted";

type TrustedTailoringContext = Readonly<{
  invokeRpc: (
    name: TrustedTailoringRpcName,
    parameters: Record<string, unknown>,
  ) => Promise<Readonly<{ data: unknown; error: unknown }>>;
}>;

export type GenerateOwnedTailoredResumeResult =
  | Readonly<{
      status: "generated" | "already_completed";
      resumeVersionId: string;
      versionName: string;
    }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "extraction_unavailable" }>
  | Readonly<{ status: "profile_unavailable" }>
  | Readonly<{ status: "invalid_extraction" }>
  | Readonly<{
      status: "insufficient_job_data" | "insufficient_candidate_data";
    }>
  | Readonly<{ status: "insufficient_credit" }>
  | Readonly<{ status: "rate_limited" }>
  | Readonly<{ status: "generation_in_progress" }>
  | Readonly<{ status: "attempt_terminal" }>
  | Readonly<{ status: "configuration_unavailable" }>
  | Readonly<{ status: "provider_unavailable" }>
  | Readonly<{ status: "invalid_provider_output" }>
  | Readonly<{ status: "persistence_failed" }>
  | Readonly<{ status: "unavailable" }>;

export type GenerateOwnedTailoredResumeDependencies = Readonly<{
  getAuthenticatedUser: () => Promise<Readonly<{ id: string }> | null>;
  getGenerationSource: (
    jobId: string,
  ) => Promise<OwnedTailoringGenerationSourceResult>;
  buildProviderInput: typeof buildTailoringProviderInputV2;
  fingerprintInput: (input: TailoringProviderInputV2) => string;
  validatePlan: (
    input: TailoringProviderInputV2,
    output: unknown,
  ) => ValidateTailoringPlanV2Result;
  buildDocument: typeof buildTailoredResumeDocument;
  buildVersionContent: typeof buildTailoredResumeVersionContent;
  provider: TailoringGenerationProvider;
  getTrustedContext: () => Promise<TrustedTailoringContext | null>;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function reserve(
  context: TrustedTailoringContext,
  userId: string,
  jobId: string,
  idempotencyKey: string,
  fingerprint: string,
): Promise<TailoringReservationRpcResult> {
  try {
    const response = await context.invokeRpc(
      "reserve_tailoring_generation_credit_trusted",
      {
        p_user_id: userId,
        p_job_posting_id: jobId,
        p_idempotency_key: idempotencyKey,
        p_input_fingerprint: fingerprint,
        p_provider_input_contract_version:
          TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
        p_provider_output_contract_version:
          TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
      },
    );
    return response.error
      ? { status: "unavailable" }
      : parseTailoringReservationRpcResult(response.data);
  } catch {
    return { status: "unavailable" };
  }
}

async function refund(
  context: TrustedTailoringContext,
  userId: string,
  reservationId: string,
) {
  try {
    const response = await context.invokeRpc(
      "refund_tailoring_generation_reservation_trusted",
      { p_user_id: userId, p_reservation_id: reservationId },
    );
    return response.error
      ? { status: "unavailable" as const }
      : parseTailoringRefundRpcResult(response.data);
  } catch {
    return { status: "unavailable" as const };
  }
}

async function finalize(
  context: TrustedTailoringContext,
  userId: string,
  reservationId: string,
  fingerprint: string,
  versionContent: TailoredResumeVersionContentV2 | Record<string, never>,
): Promise<TailoringFinalizationRpcResult> {
  try {
    const response = await context.invokeRpc(
      "finalize_tailored_resume_document_trusted",
      {
        p_user_id: userId,
        p_reservation_id: reservationId,
        p_input_fingerprint: fingerprint,
        p_provider_input_contract_version:
          TAILORING_PROVIDER_INPUT_V2_CONTRACT_VERSION,
        p_provider_output_contract_version:
          TAILORING_PLAN_OUTPUT_V2_CONTRACT_VERSION,
        p_version_content: versionContent,
      },
    );
    return response.error
      ? { status: "unavailable" }
      : parseTailoringFinalizationRpcResult(response.data);
  } catch {
    return { status: "unavailable" };
  }
}

async function refundIgnoringFailure(
  context: TrustedTailoringContext,
  userId: string,
  reservationId: string,
) {
  await refund(context, userId, reservationId);
}

export function createGenerateOwnedTailoredResumeCoordinator(
  dependencies: GenerateOwnedTailoredResumeDependencies,
): (
  jobId: string,
  idempotencyKey: string,
) => Promise<GenerateOwnedTailoredResumeResult> {
  return async function coordinateGeneration(jobId, idempotencyKey) {
    let user: Readonly<{ id: string }> | null;
    try {
      user = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unavailable" };
    }
    if (!user) return { status: "unauthenticated" };
    if (!UUID_PATTERN.test(jobId)) return { status: "not_found" };
    if (!UUID_PATTERN.test(idempotencyKey)) return { status: "unavailable" };

    let source: OwnedTailoringGenerationSourceResult;
    try {
      source = await dependencies.getGenerationSource(jobId);
    } catch {
      return { status: "unavailable" };
    }
    if (source.status !== "ready") return source;

    const projection = dependencies.buildProviderInput(
      source.preflight,
      source.resumeSourceSnapshot,
    );
    if (projection.status === "not_ready") {
      return { status: projection.readiness };
    }
    if (projection.status !== "success") return { status: "unavailable" };

    let fingerprint: string;
    let context: TrustedTailoringContext | null;
    try {
      fingerprint = dependencies.fingerprintInput(projection.input);
      context = await dependencies.getTrustedContext();
    } catch {
      return { status: "unavailable" };
    }
    if (!context) return { status: "unavailable" };

    const reservation = await reserve(
      context,
      user.id,
      jobId,
      idempotencyKey,
      fingerprint,
    );
    switch (reservation.status) {
      case "insufficient_credit":
        return { status: "insufficient_credit" };
      case "rate_limited":
        return { status: "rate_limited" };
      case "generation_in_progress":
        return { status: "generation_in_progress" };
      case "already_completed": {
        const completed = await finalize(
          context,
          user.id,
          reservation.reservationId,
          fingerprint,
          {},
        );
        return completed.status === "already_completed"
          ? {
              status: "already_completed",
              resumeVersionId: completed.resumeVersionId,
              versionName: completed.versionName,
            }
          : { status: "unavailable" };
      }
      case "terminal_refunded":
      case "terminal_expired":
        return { status: "attempt_terminal" };
      case "not_found":
        return { status: "not_found" };
      case "invalid_input":
      case "unavailable":
        return { status: "unavailable" };
      case "reserved":
        break;
    }

    let providerResult;
    try {
      providerResult = await dependencies.provider.generatePlan(projection.input);
    } catch {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "provider_unavailable" };
    }
    if (
      providerResult.status === "refusal" ||
      providerResult.status === "unavailable"
    ) {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "provider_unavailable" };
    }
    if (providerResult.status === "configuration_unavailable") {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "configuration_unavailable" };
    }
    if (providerResult.status === "invalid_output") {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "invalid_provider_output" };
    }

    let validation: ValidateTailoringPlanV2Result;
    try {
      validation = dependencies.validatePlan(
        projection.input,
        providerResult.output,
      );
    } catch {
      validation = { status: "invalid", reason: "invalid_shape" };
    }
    if (validation.status !== "valid") {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "invalid_provider_output" };
    }

    let document;
    try {
      document = dependencies.buildDocument(projection.input, validation.plan);
    } catch {
      document = { status: "invalid_document" as const };
    }
    if (document.status !== "success") {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "invalid_provider_output" };
    }

    let versionContent;
    try {
      versionContent = dependencies.buildVersionContent(
        projection.input,
        validation.plan,
        document.document,
        fingerprint,
      );
    } catch {
      versionContent = { status: "invalid" as const };
    }
    if (versionContent.status !== "success") {
      await refundIgnoringFailure(context, user.id, reservation.reservationId);
      return { status: "invalid_provider_output" };
    }

    const finalized = await finalize(
      context,
      user.id,
      reservation.reservationId,
      fingerprint,
      versionContent.content,
    );
    if (
      finalized.status === "finalized" ||
      finalized.status === "already_completed"
    ) {
      return {
        status:
          finalized.status === "finalized" ? "generated" : "already_completed",
        resumeVersionId: finalized.resumeVersionId,
        versionName: finalized.versionName,
      };
    }
    if (
      finalized.status === "terminal_refunded" ||
      finalized.status === "expired"
    ) {
      return { status: "attempt_terminal" };
    }
    await refundIgnoringFailure(context, user.id, reservation.reservationId);
    return { status: "persistence_failed" };
  };
}

async function getProductionTrustedContext(): Promise<TrustedTailoringContext | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  return {
    async invokeRpc(name, parameters) {
      const response = await supabase.rpc(name, parameters);
      return { data: response.data, error: response.error };
    },
  };
}

const productionCoordinator = createGenerateOwnedTailoredResumeCoordinator({
  async getAuthenticatedUser() {
    const user = await getSupabaseUser();
    return user ? { id: user.id } : null;
  },
  getGenerationSource: getOwnedTailoringGenerationSource,
  buildProviderInput: buildTailoringProviderInputV2,
  fingerprintInput: fingerprintTailoringProviderInputV2,
  validatePlan: validateTailoringPlanOutputV2,
  buildDocument: buildTailoredResumeDocument,
  buildVersionContent: buildTailoredResumeVersionContent,
  provider: openAITailoringGenerationProvider,
  getTrustedContext: getProductionTrustedContext,
});

export async function generateOwnedTailoredResume(
  jobId: string,
  idempotencyKey: string,
): Promise<GenerateOwnedTailoredResumeResult> {
  return productionCoordinator(jobId, idempotencyKey);
}
