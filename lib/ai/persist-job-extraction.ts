import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { JobExtractionV1 } from "./schemas/job-extraction";

type PersistenceRpcRow = {
  result_status: unknown;
  job_posting_id: unknown;
};

type PersistenceRpcInvocationResult =
  | { status: "response"; data: unknown }
  | { status: "unavailable" };

export type JobExtractionPersistenceDependencies = {
  invokeRpc: (input: {
    jobId: string;
    extraction: JobExtractionV1;
    overallConfidence: number;
  }) => Promise<PersistenceRpcInvocationResult>;
};

export type PersistJobExtractionResult =
  | { status: "updated" | "unchanged" }
  | { status: "unavailable" }
  | { status: "unsupported_source" }
  | { status: "invalid_input" }
  | { status: "persistence_unavailable" };

async function invokePersistenceRpc(input: {
  jobId: string;
  extraction: JobExtractionV1;
  overallConfidence: number;
}): Promise<PersistenceRpcInvocationResult> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "unavailable" };

    const { data, error } = await supabase.rpc("persist_job_extraction", {
      p_job_posting_id: input.jobId,
      p_extracted: input.extraction,
      p_overall_confidence: input.overallConfidence,
    });

    if (error) return { status: "unavailable" };
    return { status: "response", data };
  } catch {
    return { status: "unavailable" };
  }
}

export function createJobExtractionPersistence(
  dependencies: JobExtractionPersistenceDependencies,
): (
  jobId: string,
  extraction: JobExtractionV1,
) => Promise<PersistJobExtractionResult> {
  return async function persistCanonicalJobExtraction(jobId, extraction) {
    let invocation: PersistenceRpcInvocationResult;
    try {
      invocation = await dependencies.invokeRpc({
        jobId,
        extraction,
        overallConfidence: extraction.overallConfidence,
      });
    } catch {
      return { status: "persistence_unavailable" };
    }

    if (invocation.status !== "response") {
      return { status: "persistence_unavailable" };
    }

    const row = Array.isArray(invocation.data)
      ? invocation.data.length === 1
        ? (invocation.data[0] as PersistenceRpcRow | null)
        : null
      : (invocation.data as PersistenceRpcRow | null);

    if (
      row?.result_status === "unavailable" &&
      row.job_posting_id === null
    ) {
      return { status: "unavailable" };
    }

    if (
      row?.result_status === "invalid_input" &&
      (row.job_posting_id === null ||
        (typeof row.job_posting_id === "string" &&
          row.job_posting_id.toLowerCase() === jobId.toLowerCase()))
    ) {
      return { status: "invalid_input" };
    }

    if (
      (row?.result_status === "updated" ||
        row?.result_status === "unchanged" ||
        row?.result_status === "unsupported_source") &&
      typeof row.job_posting_id === "string" &&
      row.job_posting_id.toLowerCase() === jobId.toLowerCase()
    ) {
      return { status: row.result_status };
    }

    return { status: "persistence_unavailable" };
  };
}

const productionPersistence = createJobExtractionPersistence({
  invokeRpc: invokePersistenceRpc,
});

export async function persistJobExtraction(
  jobId: string,
  extraction: JobExtractionV1,
): Promise<PersistJobExtractionResult> {
  return productionPersistence(jobId, extraction);
}
