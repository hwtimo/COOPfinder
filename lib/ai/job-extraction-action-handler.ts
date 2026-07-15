import "server-only";

import { isUuid } from "@/lib/jobs/queries";

import type { ExtractAndPersistOwnedJobResult } from "./extract-and-persist-owned-job";

export type PrivateJobExtractionActionResult =
  | { status: "persisted" }
  | { status: "already_persisted" }
  | { status: "unauthenticated" }
  | { status: "job_unavailable" }
  | { status: "unsupported_source" }
  | { status: "invalid_job_id" }
  | { status: "configuration_unavailable" }
  | { status: "provider_refusal" }
  | { status: "provider_unavailable" }
  | { status: "invalid_structured_output" }
  | { status: "invalid_job_text" }
  | { status: "persistence_unavailable" }
  | { status: "persistence_rejected" };

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
]);

function isActionStatus(
  value: unknown,
): value is PrivateJobExtractionActionResult["status"] {
  return (
    typeof value === "string" &&
    ACTION_STATUSES.has(value as PrivateJobExtractionActionResult["status"])
  );
}

function safeBridgeResult(value: unknown): ExtractAndPersistOwnedJobResult | null {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return null;
  }

  const status = value.status;
  if (!isActionStatus(status)) return null;

  return { status } as ExtractAndPersistOwnedJobResult;
}

export function createPrivateJobExtractionActionHandler(
  dependencies: PrivateJobExtractionActionDependencies,
): (jobId: string) => Promise<PrivateJobExtractionActionResult> {
  return async function handlePrivateJobExtraction(jobId) {
    if (typeof jobId !== "string" || !isUuid(jobId)) {
      return { status: "invalid_job_id" };
    }

    let bridgeResult: unknown;
    try {
      bridgeResult = await dependencies.runBridge(jobId);
    } catch {
      return { status: "provider_unavailable" };
    }

    const safeResult = safeBridgeResult(bridgeResult);
    if (!safeResult) return { status: "persistence_unavailable" };

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
