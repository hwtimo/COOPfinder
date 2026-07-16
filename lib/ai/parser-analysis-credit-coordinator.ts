import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  extractAndPersistOwnedJob,
  type ExtractAndPersistOwnedJobResult,
} from "./extract-and-persist-owned-job";

type ParserCreditRpcName =
  | "reserve_parser_analysis_credit"
  | "finalize_parser_analysis_credit";

type ParserCreditRpcResponse = {
  data: unknown;
  error: unknown;
};

type ParserCreditRequestContext =
  | {
      status: "ready";
      invokeRpc: (
        name: ParserCreditRpcName,
        parameters: Record<string, unknown>,
      ) => Promise<ParserCreditRpcResponse>;
    }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

type ReserveParserCreditResult =
  | { status: "reserved"; reservationId: string }
  | { status: "no_credits" }
  | { status: "daily_limit" }
  | { status: "unsupported_source" }
  | { status: "invalid_input" }
  | { status: "unavailable" };

type FinalizeParserCreditResult =
  | { status: "consumed" | "refunded" }
  | { status: "transport_failure" }
  | { status: "unconfirmed" };

export type ParserCreditEnforcedJobResult =
  | ExtractAndPersistOwnedJobResult
  | { status: "no_credits" }
  | { status: "daily_limit" }
  | { status: "credit_unavailable" };

export type ParserAnalysisCreditCoordinatorDependencies = {
  getRequestContext: () => Promise<ParserCreditRequestContext>;
  runBridge: (jobId: string) => Promise<ExtractAndPersistOwnedJobResult>;
  reportDiagnostic: (event: "consume_unconfirmed" | "refund_unconfirmed") => void;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function singleRow(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const row = data[0];
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : null;
}

async function reserveParserCredit(
  context: Extract<ParserCreditRequestContext, { status: "ready" }>,
  jobId: string,
): Promise<ReserveParserCreditResult> {
  let response: ParserCreditRpcResponse;
  try {
    response = await context.invokeRpc("reserve_parser_analysis_credit", {
      p_job_posting_id: jobId,
    });
  } catch {
    return { status: "unavailable" };
  }

  if (response.error) return { status: "unavailable" };

  const row = singleRow(response.data);
  if (!row || typeof row.result_status !== "string") {
    return { status: "unavailable" };
  }

  switch (row.result_status) {
    case "reserved":
      return typeof row.reservation_id === "string" &&
        UUID_PATTERN.test(row.reservation_id)
        ? { status: "reserved", reservationId: row.reservation_id }
        : { status: "unavailable" };
    case "no_credits":
      return { status: "no_credits" };
    case "daily_limit":
      return { status: "daily_limit" };
    case "unsupported_source":
      return { status: "unsupported_source" };
    case "invalid_input":
      return { status: "invalid_input" };
    case "unavailable":
      return { status: "unavailable" };
    default:
      return { status: "unavailable" };
  }
}

async function finalizeParserCreditOnce(
  context: Extract<ParserCreditRequestContext, { status: "ready" }>,
  reservationId: string,
  succeeded: boolean,
): Promise<FinalizeParserCreditResult> {
  let response: ParserCreditRpcResponse;
  try {
    response = await context.invokeRpc("finalize_parser_analysis_credit", {
      p_reservation_id: reservationId,
      p_succeeded: succeeded,
    });
  } catch {
    return { status: "transport_failure" };
  }

  if (response.error) return { status: "transport_failure" };

  const row = singleRow(response.data);
  if (
    row?.result_status === "consumed" ||
    row?.result_status === "refunded"
  ) {
    return { status: row.result_status };
  }

  return { status: "unconfirmed" };
}

async function finalizeParserCredit(
  context: Extract<ParserCreditRequestContext, { status: "ready" }>,
  reservationId: string,
  succeeded: boolean,
): Promise<boolean> {
  const expectedStatus = succeeded ? "consumed" : "refunded";
  const first = await finalizeParserCreditOnce(
    context,
    reservationId,
    succeeded,
  );
  if (first.status === expectedStatus) return true;
  if (first.status !== "transport_failure") return false;

  const retry = await finalizeParserCreditOnce(
    context,
    reservationId,
    succeeded,
  );
  return retry.status === expectedStatus;
}

export function createParserAnalysisCreditCoordinator(
  dependencies: ParserAnalysisCreditCoordinatorDependencies,
): (jobId: string) => Promise<ParserCreditEnforcedJobResult> {
  return async function coordinateParserAnalysis(jobId) {
    let context: ParserCreditRequestContext;
    try {
      context = await dependencies.getRequestContext();
    } catch {
      return { status: "credit_unavailable" };
    }
    if (context.status === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    if (context.status === "unavailable") {
      return { status: "credit_unavailable" };
    }

    const reservation = await reserveParserCredit(context, jobId);
    switch (reservation.status) {
      case "no_credits":
        return { status: "no_credits" };
      case "daily_limit":
        return { status: "daily_limit" };
      case "unsupported_source":
        return { status: "unsupported_source" };
      case "invalid_input":
        return { status: "invalid_job_text" };
      case "unavailable":
        return { status: "credit_unavailable" };
      case "reserved":
        break;
    }

    let bridgeResult: ExtractAndPersistOwnedJobResult;
    try {
      bridgeResult = await dependencies.runBridge(jobId);
    } catch {
      bridgeResult = { status: "provider_unavailable" };
    }

    const succeeded =
      bridgeResult.status === "persisted" ||
      bridgeResult.status === "already_persisted";
    const finalized = await finalizeParserCredit(
      context,
      reservation.reservationId,
      succeeded,
    );

    if (!finalized) {
      dependencies.reportDiagnostic(
        succeeded ? "consume_unconfirmed" : "refund_unconfirmed",
      );
      return { status: "credit_unavailable" };
    }

    return bridgeResult;
  };
}

async function getProductionRequestContext(): Promise<ParserCreditRequestContext> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: "unauthenticated" };

  return {
    status: "ready",
    async invokeRpc(name, parameters) {
      const response = await supabase.rpc(name, parameters);
      return { data: response.data, error: response.error };
    },
  };
}

const productionCoordinator = createParserAnalysisCreditCoordinator({
  getRequestContext: getProductionRequestContext,
  runBridge: extractAndPersistOwnedJob,
  reportDiagnostic(event) {
    console.error(`[parser-analysis-credit] ${event}`);
  },
});

export async function extractAndPersistOwnedJobWithCredits(
  jobId: string,
): Promise<ParserCreditEnforcedJobResult> {
  return productionCoordinator(jobId);
}
