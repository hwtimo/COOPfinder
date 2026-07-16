import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PRIVATE_JOB_DESCRIPTION_MAX_LENGTH } from "./job-url-intake";

export type ManualJobDescriptionTransitionResult =
  | { status: "success" }
  | { status: "invalid_job_text" }
  | { status: "unauthenticated" }
  | { status: "job_unavailable" }
  | { status: "persistence_unavailable" };

type TransitionResponse = {
  data: unknown;
  error: unknown;
};

type ManualJobDescriptionRequestContext =
  | {
      status: "ready";
      updateOwnedPastedUrlJob: (
        jobId: string,
        rawText: string,
      ) => Promise<TransitionResponse>;
    }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export type ManualJobDescriptionTransitionDependencies = {
  getRequestContext: () => Promise<ManualJobDescriptionRequestContext>;
};

const PRIVATE_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function updatedJobId(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("id" in data)) {
    return null;
  }
  return typeof data.id === "string" ? data.id : null;
}

export function createManualJobDescriptionTransitionHandler(
  dependencies: ManualJobDescriptionTransitionDependencies,
): (jobId: string, rawText: unknown) => Promise<ManualJobDescriptionTransitionResult> {
  return async function transitionManualJobDescription(jobId, rawText) {
    if (typeof jobId !== "string" || !PRIVATE_JOB_ID_PATTERN.test(jobId)) {
      return { status: "job_unavailable" };
    }
    if (typeof rawText !== "string") return { status: "invalid_job_text" };

    const normalizedText = rawText.trim();
    if (
      !normalizedText ||
      normalizedText.length > PRIVATE_JOB_DESCRIPTION_MAX_LENGTH
    ) {
      return { status: "invalid_job_text" };
    }

    let context: ManualJobDescriptionRequestContext;
    try {
      context = await dependencies.getRequestContext();
    } catch {
      return { status: "persistence_unavailable" };
    }

    if (context.status === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    if (context.status === "unavailable") {
      return { status: "persistence_unavailable" };
    }

    let response: TransitionResponse;
    try {
      response = await context.updateOwnedPastedUrlJob(jobId, normalizedText);
    } catch {
      return { status: "persistence_unavailable" };
    }

    if (response.error) return { status: "persistence_unavailable" };
    const persistedJobId = updatedJobId(response.data);
    if (!persistedJobId) return { status: "job_unavailable" };
    if (persistedJobId.toLowerCase() !== jobId.toLowerCase()) {
      return { status: "persistence_unavailable" };
    }

    return { status: "success" };
  };
}

async function getProductionRequestContext(): Promise<ManualJobDescriptionRequestContext> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: "unauthenticated" };

  return {
    status: "ready",
    async updateOwnedPastedUrlJob(jobId, rawText) {
      const response = await supabase
        .from("job_postings")
        .update({ raw_text: rawText, intake_source: "pasted_text" })
        .eq("id", jobId)
        .eq("user_id", user.id)
        .eq("intake_source", "pasted_url")
        .select("id")
        .maybeSingle();

      return { data: response.data, error: response.error };
    },
  };
}

const productionHandler = createManualJobDescriptionTransitionHandler({
  getRequestContext: getProductionRequestContext,
});

export async function transitionPastedUrlJobToManualText(
  jobId: string,
  rawText: unknown,
): Promise<ManualJobDescriptionTransitionResult> {
  return productionHandler(jobId, rawText);
}
