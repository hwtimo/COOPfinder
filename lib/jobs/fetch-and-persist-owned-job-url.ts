import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  fetchOwnedJobSourceUrl,
  type JobUrlFetchResult,
} from "./job-url-fetch-transport";
import { updateOwnedPastedUrlJobText } from "./manual-job-description-transition";

export type FetchAndPersistOwnedJobUrlResult =
  | { status: "success" }
  | { status: "unauthenticated" }
  | { status: "job_unavailable" }
  | { status: "manual_paste_required" }
  | { status: "persistence_unavailable" };

type PersistenceResponse = {
  data: unknown;
  error: unknown;
};

type PersistenceContext =
  | {
      status: "ready";
      persistFetchedText: (
        jobId: string,
        sourceUrl: string,
        text: string,
      ) => Promise<PersistenceResponse>;
    }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export type FetchAndPersistOwnedJobUrlDependencies = {
  fetchOwnedSource: (jobId: string) => Promise<JobUrlFetchResult>;
  getPersistenceContext: () => Promise<PersistenceContext>;
};

const PRIVATE_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function persistedJobId(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("id" in data)) {
    return null;
  }
  return typeof data.id === "string" ? data.id : null;
}

export function createFetchAndPersistOwnedJobUrlHandler(
  dependencies: FetchAndPersistOwnedJobUrlDependencies,
): (jobId: string) => Promise<FetchAndPersistOwnedJobUrlResult> {
  return async function fetchAndPersistOwnedJobUrl(jobId) {
    if (!PRIVATE_JOB_ID_PATTERN.test(jobId)) {
      return { status: "job_unavailable" };
    }

    let fetched: JobUrlFetchResult;
    try {
      fetched = await dependencies.fetchOwnedSource(jobId);
    } catch {
      return { status: "manual_paste_required" };
    }

    if (fetched.status === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    if (fetched.status === "job_unavailable") {
      return { status: "job_unavailable" };
    }
    if (fetched.status !== "success") {
      return { status: "manual_paste_required" };
    }

    let context: PersistenceContext;
    try {
      context = await dependencies.getPersistenceContext();
    } catch {
      return { status: "persistence_unavailable" };
    }
    if (context.status === "unauthenticated") {
      return { status: "unauthenticated" };
    }
    if (context.status === "unavailable") {
      return { status: "persistence_unavailable" };
    }

    let response: PersistenceResponse;
    try {
      response = await context.persistFetchedText(
        jobId,
        fetched.sourceUrl,
        fetched.text,
      );
    } catch {
      return { status: "persistence_unavailable" };
    }
    if (response.error) return { status: "persistence_unavailable" };

    const updatedId = persistedJobId(response.data);
    if (!updatedId) return { status: "job_unavailable" };
    if (updatedId.toLowerCase() !== jobId.toLowerCase()) {
      return { status: "persistence_unavailable" };
    }

    return { status: "success" };
  };
}

async function getProductionPersistenceContext(): Promise<PersistenceContext> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unavailable" };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: "unauthenticated" };

  return {
    status: "ready",
    persistFetchedText(jobId, sourceUrl, text) {
      return updateOwnedPastedUrlJobText(
        supabase,
        user.id,
        jobId,
        text,
        sourceUrl,
      );
    },
  };
}

const productionHandler = createFetchAndPersistOwnedJobUrlHandler({
  fetchOwnedSource: fetchOwnedJobSourceUrl,
  getPersistenceContext: getProductionPersistenceContext,
});

export async function fetchAndPersistOwnedJobUrl(
  jobId: string,
): Promise<FetchAndPersistOwnedJobUrlResult> {
  return productionHandler(jobId);
}
