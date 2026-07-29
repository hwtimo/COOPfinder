import "server-only";

import { isUuid } from "@/lib/jobs/queries";

import type { ParserCreditEnforcedJobResult } from "./parser-analysis-credit-coordinator";
import type { ParserAnalysisCreditResult } from "./parser-analysis-credit-coordinator";

export type PrivateJobExtractionActionResult =
  | ParserCreditEnforcedJobResult
  | { status: "invalid_job_id"; creditResult: "not_used" };

export type PrivateJobExtractionActionDependencies = {
  runBridge: (jobId: string) => Promise<unknown>;
  revalidatePath: (path: string) => void;
};

const ACTION_STATUSES = new Set<PrivateJobExtractionActionResult["status"]>([
  "persisted",
  "already_persisted",
  "unauthenticated",
  "job_unavailable",
  "unsupported_source",
  "invalid_job_id",
  "configuration_unavailable",
  "provider_refusal",
  "provider_unavailable",
  "invalid_structured_output",
  "invalid_job_text",
  "persistence_unavailable",
  "persistence_rejected",
  "no_credits",
  "daily_limit",
  "credit_unavailable",
]);

function isActionStatus(
  value: unknown,
): value is PrivateJobExtractionActionResult["status"] {
  return (
    typeof value === "string" &&
    ACTION_STATUSES.has(value as PrivateJobExtractionActionResult["status"])
  );
}

function safeBridgeResult(value: unknown): ParserCreditEnforcedJobResult | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("status" in value) ||
    !("creditResult" in value)
  ) {
    return null;
  }

  const status = value.status;
  const creditResult = value.creditResult;
  const creditResults = new Set<ParserAnalysisCreditResult>([
    "used",
    "not_used",
    "refunded",
    "refund_unavailable",
  ]);
  if (
    !isActionStatus(status) ||
    typeof creditResult !== "string" ||
    !creditResults.has(creditResult as ParserAnalysisCreditResult)
  ) {
    return null;
  }

  return { status, creditResult } as ParserCreditEnforcedJobResult;
}

export function createPrivateJobExtractionActionHandler(
  dependencies: PrivateJobExtractionActionDependencies,
): (jobId: string) => Promise<PrivateJobExtractionActionResult> {
  return async function handlePrivateJobExtraction(jobId) {
    if (typeof jobId !== "string" || !isUuid(jobId)) {
      return { status: "invalid_job_id", creditResult: "not_used" };
    }

    let bridgeResult: unknown;
    try {
      bridgeResult = await dependencies.runBridge(jobId);
    } catch {
      return {
        status: "provider_unavailable",
        creditResult: "refund_unavailable",
      };
    }

    const safeResult = safeBridgeResult(bridgeResult);
    if (!safeResult) {
      return {
        status: "persistence_unavailable",
        creditResult: "refund_unavailable",
      };
    }

    if (
      safeResult.status === "persisted" ||
      safeResult.status === "already_persisted"
    ) {
      try {
        dependencies.revalidatePath(`/jobs/${jobId}`);
      } catch {
        // Persistence already succeeded; a cache refresh failure must not alter it.
      }
    }

    return safeResult;
  };
}
