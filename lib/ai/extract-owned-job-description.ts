import "server-only";

import type { PrivateJobIntakeSource } from "@/lib/jobs/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  extractJobDescription,
  PRIVATE_JOB_DESCRIPTION_MAX_LENGTH,
  type ExtractJobDescriptionResult,
} from "./extract-job-description";

type AuthenticatedUserLookupResult =
  | { status: "authenticated"; userId: string }
  | { status: "unauthenticated" };

type OwnedJobExtractionRow = {
  intakeSource: PrivateJobIntakeSource;
  rawText: string | null;
};

type OwnedJobLookupResult =
  | { status: "ready"; job: OwnedJobExtractionRow | null }
  | { status: "unavailable" };

export type OwnedJobExtractionDependencies = {
  getAuthenticatedUser: () => Promise<AuthenticatedUserLookupResult>;
  getOwnedJob: (input: {
    jobId: string;
    userId: string;
  }) => Promise<OwnedJobLookupResult>;
  extract: (rawText: unknown) => Promise<ExtractJobDescriptionResult>;
};

export type ExtractOwnedJobDescriptionResult =
  | ExtractJobDescriptionResult
  | {
      status: "unauthenticated";
      retryable: false;
    }
  | {
      status: "invalid_job_id";
      retryable: false;
    }
  | {
      status: "job_unavailable";
      retryable: false;
    }
  | {
      status: "unsupported_intake_source";
      retryable: false;
    }
  | {
      status: "missing_job_description";
      retryable: false;
    };

const PRIVATE_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAuthenticatedUser(): Promise<AuthenticatedUserLookupResult> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "unauthenticated" };

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return { status: "unauthenticated" };

    return { status: "authenticated", userId: user.id };
  } catch {
    return { status: "unauthenticated" };
  }
}

async function getOwnedJob(input: {
  jobId: string;
  userId: string;
}): Promise<OwnedJobLookupResult> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "unavailable" };

    const { data, error } = await supabase
      .from("job_postings")
      .select("intake_source,raw_text")
      .eq("id", input.jobId)
      .eq("user_id", input.userId)
      .maybeSingle();

    if (error) return { status: "unavailable" };
    if (!data) return { status: "ready", job: null };

    return {
      status: "ready",
      job: {
        intakeSource: data.intake_source as PrivateJobIntakeSource,
        rawText: data.raw_text,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function createOwnedJobExtractionOrchestrator(
  dependencies: OwnedJobExtractionDependencies,
): (jobId: string) => Promise<ExtractOwnedJobDescriptionResult> {
  return async function orchestrateOwnedJobExtraction(jobId) {
    if (typeof jobId !== "string" || !PRIVATE_JOB_ID_PATTERN.test(jobId)) {
      return { status: "invalid_job_id", retryable: false };
    }

    let authentication: AuthenticatedUserLookupResult;
    try {
      authentication = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unauthenticated", retryable: false };
    }

    if (authentication.status !== "authenticated") {
      return { status: "unauthenticated", retryable: false };
    }

    let lookup: OwnedJobLookupResult;
    try {
      lookup = await dependencies.getOwnedJob({
        jobId,
        userId: authentication.userId,
      });
    } catch {
      return { status: "job_unavailable", retryable: false };
    }

    if (lookup.status !== "ready" || !lookup.job) {
      return { status: "job_unavailable", retryable: false };
    }

    if (lookup.job.intakeSource !== "pasted_text") {
      return { status: "unsupported_intake_source", retryable: false };
    }

    const { rawText } = lookup.job;
    if (typeof rawText !== "string" || !rawText.trim()) {
      return { status: "missing_job_description", retryable: false };
    }

    if (rawText.length > PRIVATE_JOB_DESCRIPTION_MAX_LENGTH) {
      return {
        status: "invalid_input",
        reason: "input_too_long",
        retryable: false,
      };
    }

    try {
      return await dependencies.extract(rawText);
    } catch {
      return {
        status: "provider_unavailable",
        reason: "provider_unavailable",
        retryable: true,
      };
    }
  };
}

const productionOrchestrator = createOwnedJobExtractionOrchestrator({
  getAuthenticatedUser,
  getOwnedJob,
  extract: extractJobDescription,
});

export async function extractOwnedJobDescription(
  jobId: string,
): Promise<ExtractOwnedJobDescriptionResult> {
  return productionOrchestrator(jobId);
}
