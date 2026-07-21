import "server-only";

import type { User } from "@supabase/supabase-js";

import { getOwnedApplicationTrackingLinks } from "@/lib/applications/queries";
import type { ApplicationTrackingLink } from "@/lib/applications/types";
import {
  parseJobExtractionOutput,
  type ParseJobExtractionResult,
} from "@/lib/ai/schemas/job-extraction";
import {
  getPrivateJobsForMatching,
  type PrivateJobMatchSource,
} from "@/lib/jobs/queries";
import { getMasterProfile } from "@/lib/master-profile/queries";
import type { MasterProfileData } from "@/lib/master-profile/types";
import { getSupabaseUser } from "@/lib/supabase/user";

import {
  matchResumeToJob,
  type ResumeJobExactMatchResult,
} from "./resume-job-match";
import type {
  OwnedJobMatchSummary,
  OwnedJobMatchSummaryStatus,
} from "./job-match-summary";

type AuthenticatedUser = Pick<User, "id" | "email">;

type AuthenticationResult =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "unauthenticated" };

type ProfileLookupResult =
  | { status: "ready"; profile: MasterProfileData }
  | { status: "missing" | "unavailable" };

type JobsLookupResult =
  | { status: "ready"; jobs: PrivateJobMatchSource[] }
  | { status: "unavailable" };

type ApplicationsLookupResult =
  | { status: "ready"; applications: ApplicationTrackingLink[] }
  | { status: "unavailable" };

export type OwnedJobMatchesResult =
  | { status: "ready"; jobs: OwnedJobMatchSummary[] }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

export type OwnedJobMatchesDependencies = {
  getAuthenticatedUser: () => Promise<AuthenticationResult>;
  getOwnedProfile: (input: {
    userId: string;
    email: string;
  }) => Promise<ProfileLookupResult>;
  getOwnedJobs: (input: { userId: string }) => Promise<JobsLookupResult>;
  getOwnedApplications: (input: {
    userId: string;
  }) => Promise<ApplicationsLookupResult>;
  parseExtraction: (extraction: unknown) => ParseJobExtractionResult;
  match: typeof matchResumeToJob;
};

function hasPersistedExtraction(value: unknown) {
  return !(
    value === null ||
    value === undefined ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function invalidExtractionSummary(
  job: PrivateJobMatchSource,
  application: ApplicationTrackingLink | null,
): OwnedJobMatchSummary {
  return {
    jobId: job.id,
    title: job.title,
    companyName: job.companyName,
    location: job.location,
    updatedAt: job.updatedAt,
    status: "invalid_extraction",
    required: null,
    preferred: null,
    workAuthorizationStatus: null,
    notEvidencedRequiredCount: null,
    unassessedRequirementCount: null,
    application,
  };
}

function matchedSummary(
  job: PrivateJobMatchSource,
  match: ResumeJobExactMatchResult,
  profileIsMissing: boolean,
  application: ApplicationTrackingLink | null,
): OwnedJobMatchSummary {
  const status: OwnedJobMatchSummaryStatus =
    match.status === "insufficient_job_data"
      ? "insufficient_job_data"
      : profileIsMissing ||
          match.status === "insufficient_candidate_data" ||
          (match.dataCompleteness.uniqueCandidateTerms === 0 &&
            match.workAuthorization.candidateValue === null)
      ? "insufficient_profile"
      : "comparable";

  return {
    jobId: job.id,
    title: job.title,
    companyName: job.companyName,
    location: job.location,
    updatedAt: job.updatedAt,
    status,
    required: {
      evidenced: match.required.matchedCount,
      total: match.required.totalUniqueRequirements,
    },
    preferred: {
      evidenced: match.preferred.matchedCount,
      total: match.preferred.totalUniqueRequirements,
    },
    workAuthorizationStatus: match.workAuthorization.status,
    notEvidencedRequiredCount: match.required.notEvidencedItems.length,
    unassessedRequirementCount:
      match.dataCompleteness.unassessedJobRequirements,
    application,
  };
}

function emptyProfile(email: string): MasterProfileData {
  return {
    fullName: "",
    email,
    school: "",
    program: "",
    gradYear: "",
    coopTerm: "",
    workAuthorization: "",
    preferredLocations: [],
    targetRoles: [],
    skills: [],
    entries: [],
  };
}

export function createOwnedJobMatchesCoordinator(
  dependencies: OwnedJobMatchesDependencies,
): () => Promise<OwnedJobMatchesResult> {
  return async function coordinateOwnedJobMatches() {
    let authentication: AuthenticationResult;
    try {
      authentication = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unavailable" };
    }

    if (authentication.status !== "authenticated") {
      return { status: "unauthenticated" };
    }

    let profileLookup: ProfileLookupResult;
    let jobsLookup: JobsLookupResult;
    let applicationsLookup: ApplicationsLookupResult;
    try {
      [profileLookup, jobsLookup, applicationsLookup] = await Promise.all([
        dependencies.getOwnedProfile({
          userId: authentication.user.id,
          email: authentication.user.email ?? "",
        }),
        dependencies.getOwnedJobs({ userId: authentication.user.id }),
        dependencies.getOwnedApplications({
          userId: authentication.user.id,
        }),
      ]);
    } catch {
      return { status: "unavailable" };
    }

    if (
      profileLookup.status === "unavailable" ||
      jobsLookup.status === "unavailable" ||
      applicationsLookup.status === "unavailable"
    ) {
      return { status: "unavailable" };
    }

    const profileIsMissing = profileLookup.status === "missing";
    const profile =
      profileLookup.status === "ready"
        ? profileLookup.profile
        : emptyProfile(authentication.user.email ?? "");
    const jobs: OwnedJobMatchSummary[] = [];
    const applicationsByJobId = new Map(
      applicationsLookup.applications.map((application) => [
        application.jobPostingId,
        application,
      ]),
    );

    for (const job of jobsLookup.jobs) {
      if (!hasPersistedExtraction(job.extracted)) continue;
      const application = applicationsByJobId.get(job.id) ?? null;

      let parsed: ParseJobExtractionResult;
      try {
        parsed = dependencies.parseExtraction(job.extracted);
      } catch {
        jobs.push(invalidExtractionSummary(job, application));
        continue;
      }

      if (parsed.status !== "valid") {
        jobs.push(invalidExtractionSummary(job, application));
        continue;
      }

      try {
        jobs.push(
          matchedSummary(
            job,
            dependencies.match(parsed.canonicalRequirements, profile),
            profileIsMissing,
            application,
          ),
        );
      } catch {
        jobs.push(invalidExtractionSummary(job, application));
      }
    }

    return { status: "ready", jobs };
  };
}

async function getAuthenticatedUser(): Promise<AuthenticationResult> {
  const user = await getSupabaseUser();
  return user
    ? { status: "authenticated", user }
    : { status: "unauthenticated" };
}

const productionCoordinator = createOwnedJobMatchesCoordinator({
  getAuthenticatedUser,
  async getOwnedProfile({ userId, email }) {
    const result = await getMasterProfile(userId, email);
    return result.status === "ready"
      ? { status: "ready", profile: result.data }
      : { status: "unavailable" };
  },
  async getOwnedJobs({ userId }) {
    const result = await getPrivateJobsForMatching(userId);
    return result.status === "ready"
      ? { status: "ready", jobs: result.data }
      : { status: "unavailable" };
  },
  async getOwnedApplications({ userId }) {
    const result = await getOwnedApplicationTrackingLinks(userId);
    return result.status === "ready"
      ? { status: "ready", applications: result.data }
      : { status: "unavailable" };
  },
  parseExtraction: parseJobExtractionOutput,
  match: matchResumeToJob,
});

export async function getOwnedJobMatches(): Promise<OwnedJobMatchesResult> {
  return productionCoordinator();
}
