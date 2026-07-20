import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  parseJobExtractionOutput,
  type ParseJobExtractionResult,
} from "@/lib/ai/schemas/job-extraction";
import { getPrivateJob } from "@/lib/jobs/queries";
import type { MasterProfileData } from "@/lib/master-profile/types";
import { getMasterProfile } from "@/lib/master-profile/queries";
import { getSupabaseUser } from "@/lib/supabase/user";

import {
  matchResumeToJob,
  type ResumeJobExactMatchResult,
} from "./resume-job-match";

type AuthenticatedUser = Pick<User, "id" | "email">;

type AuthenticationResult =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "unauthenticated" };

export type OwnedJobMatchSource = {
  id: string;
  extracted: unknown;
  title?: string;
  companyName?: string | null;
  location?: string | null;
};

type OwnedJobLookupResult =
  | { status: "ready"; job: OwnedJobMatchSource | null }
  | { status: "unavailable" };

type ProfileLookupResult =
  | { status: "ready"; profile: MasterProfileData }
  | { status: "missing" | "unavailable" };

export type OwnedJobMatchDependencies = {
  getAuthenticatedUser: () => Promise<AuthenticationResult>;
  getOwnedJob: (input: {
    jobId: string;
    userId: string;
  }) => Promise<OwnedJobLookupResult>;
  getOwnedProfile: (input: {
    userId: string;
    email: string;
  }) => Promise<ProfileLookupResult>;
  parseExtraction: (extraction: unknown) => ParseJobExtractionResult;
  match: typeof matchResumeToJob;
};

export type OwnedJobMatchResult =
  | {
      status: "matched";
      jobId: string;
      match: ResumeJobExactMatchResult;
    }
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "extraction_unavailable" }
  | { status: "profile_unavailable" }
  | { status: "invalid_extraction" }
  | { status: "unavailable" };

export type OwnedJobMatchContextResult =
  | {
      status: "matched";
      job: OwnedJobMatchSource;
      profile: MasterProfileData;
      canonicalRequirements: Extract<
        ParseJobExtractionResult,
        { status: "valid" }
      >["canonicalRequirements"];
      match: ResumeJobExactMatchResult;
    }
  | Exclude<OwnedJobMatchResult, { status: "matched" }>;

function hasNoPersistedExtraction(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

export function createOwnedJobMatchContextCoordinator(
  dependencies: OwnedJobMatchDependencies,
): (jobId: string) => Promise<OwnedJobMatchContextResult> {
  return async function coordinateOwnedJobMatch(jobId) {
    let authentication: AuthenticationResult;
    try {
      authentication = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unavailable" };
    }

    if (authentication.status !== "authenticated") {
      return { status: "unauthenticated" };
    }

    let jobLookup: OwnedJobLookupResult;
    try {
      jobLookup = await dependencies.getOwnedJob({
        jobId,
        userId: authentication.user.id,
      });
    } catch {
      return { status: "unavailable" };
    }

    if (jobLookup.status !== "ready") return { status: "unavailable" };
    if (!jobLookup.job) return { status: "not_found" };
    if (hasNoPersistedExtraction(jobLookup.job.extracted)) {
      return { status: "extraction_unavailable" };
    }

    let parsedExtraction: ParseJobExtractionResult;
    try {
      parsedExtraction = dependencies.parseExtraction(jobLookup.job.extracted);
    } catch {
      return { status: "invalid_extraction" };
    }
    if (parsedExtraction.status !== "valid") {
      return { status: "invalid_extraction" };
    }

    let profileLookup: ProfileLookupResult;
    try {
      profileLookup = await dependencies.getOwnedProfile({
        userId: authentication.user.id,
        email: authentication.user.email ?? "",
      });
    } catch {
      return { status: "unavailable" };
    }
    if (profileLookup.status !== "ready") {
      return { status: "profile_unavailable" };
    }

    try {
      return {
        status: "matched",
        job: jobLookup.job,
        profile: profileLookup.profile,
        canonicalRequirements: parsedExtraction.canonicalRequirements,
        match: dependencies.match(
          parsedExtraction.canonicalRequirements,
          profileLookup.profile,
        ),
      };
    } catch {
      return { status: "unavailable" };
    }
  };
}

export function createOwnedJobMatchCoordinator(
  dependencies: OwnedJobMatchDependencies,
): (jobId: string) => Promise<OwnedJobMatchResult> {
  const coordinateContext = createOwnedJobMatchContextCoordinator(dependencies);

  return async function coordinateOwnedJobMatch(jobId) {
    const result = await coordinateContext(jobId);
    if (result.status !== "matched") return result;

    return {
      status: "matched",
      jobId: result.job.id,
      match: result.match,
    };
  };
}

async function getAuthenticatedUser(): Promise<AuthenticationResult> {
  const user = await getSupabaseUser();
  return user
    ? { status: "authenticated", user }
    : { status: "unauthenticated" };
}

const productionContextCoordinator = createOwnedJobMatchContextCoordinator({
  getAuthenticatedUser,
  async getOwnedJob({ jobId, userId }) {
    const result = await getPrivateJob(userId, jobId);
    return result.status === "ready"
      ? {
          status: "ready",
          job: result.data
            ? {
                id: result.data.id,
                extracted: result.data.extracted,
                title: result.data.title,
                companyName: result.data.companyName,
                location: result.data.location,
              }
            : null,
        }
      : { status: "unavailable" };
  },
  async getOwnedProfile({ userId, email }) {
    const result = await getMasterProfile(userId, email);
    return result.status === "ready"
      ? { status: "ready", profile: result.data }
      : { status: "unavailable" };
  },
  parseExtraction: parseJobExtractionOutput,
  match: matchResumeToJob,
});

export async function getOwnedJobMatch(
  jobId: string,
): Promise<OwnedJobMatchResult> {
  const result = await productionContextCoordinator(jobId);
  if (result.status !== "matched") return result;

  return {
    status: "matched",
    jobId: result.job.id,
    match: result.match,
  };
}

export async function getOwnedJobMatchContext(
  jobId: string,
): Promise<OwnedJobMatchContextResult> {
  return productionContextCoordinator(jobId);
}
