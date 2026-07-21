import "server-only";

import {
  parseJobExtractionOutput,
  type ParseJobExtractionResult,
} from "@/lib/ai/schemas/job-extraction";
import {
  getPrivateJobForWorkflow,
  type PrivateJobMatchSource,
} from "@/lib/jobs/queries";
import { getMasterProfile } from "@/lib/master-profile/queries";
import type { MasterProfileData } from "@/lib/master-profile/types";
import { matchResumeToJob } from "@/lib/matching/resume-job-match";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTailoredResumeVersionContent } from "@/lib/tailoring/tailored-resume-version-content";
import {
  buildTailoringPreflight,
  type BuildTailoringPreflightInput,
} from "@/lib/tailoring/tailoring-preflight";

type JobLookup =
  | { status: "ready"; job: PrivateJobMatchSource | null }
  | { status: "unavailable" };

type ProfileLookup =
  | { status: "ready"; profile: MasterProfileData }
  | { status: "unavailable" };

type ResumeVersionSource = {
  id: string;
  jobPostingId: string | null;
  content: unknown;
};

type ResumeVersionsLookup =
  | { status: "ready"; versions: ResumeVersionSource[] }
  | { status: "unavailable" };

export type ApplicationWorkflowState = Readonly<{
  analysis: "ready" | "not_analyzed" | "unavailable";
  match:
    | "comparable"
    | "insufficient_profile"
    | "insufficient_job_data"
    | "analysis_required"
    | "unavailable";
  tailoring:
    | "ready"
    | "insufficient_profile"
    | "insufficient_job_data"
    | "analysis_required"
    | "unavailable";
  resume:
    | Readonly<{ status: "ready"; versionId: string }>
    | Readonly<{ status: "none" | "unavailable" }>;
}>;

export type OwnedApplicationWorkflowResult =
  | { status: "ready"; workflow: ApplicationWorkflowState }
  | { status: "unavailable" };

export type OwnedApplicationWorkflowDependencies = Readonly<{
  getOwnedJob: (input: {
    userId: string;
    jobId: string;
  }) => Promise<JobLookup>;
  getOwnedProfile: (input: {
    userId: string;
    email: string;
  }) => Promise<ProfileLookup>;
  getOwnedResumeVersions: (input: {
    userId: string;
    jobId: string;
  }) => Promise<ResumeVersionsLookup>;
  parseExtraction: (value: unknown) => ParseJobExtractionResult;
  match: typeof matchResumeToJob;
  buildPreflight: (
    input: BuildTailoringPreflightInput,
  ) => ReturnType<typeof buildTailoringPreflight>;
  parseResumeVersion: typeof parseTailoredResumeVersionContent;
}>;

function hasPersistedExtraction(value: unknown) {
  return !(
    value === null ||
    value === undefined ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function resumeState(
  lookup: ResumeVersionsLookup,
  jobId: string,
  parse: typeof parseTailoredResumeVersionContent,
): ApplicationWorkflowState["resume"] {
  if (lookup.status !== "ready") return { status: "unavailable" };
  for (const version of lookup.versions) {
    if (version.jobPostingId !== jobId) continue;
    try {
      if (parse(version.content).status === "valid") {
        return { status: "ready", versionId: version.id };
      }
    } catch {
      continue;
    }
  }
  return { status: "none" };
}

export function createOwnedApplicationWorkflowCoordinator(
  dependencies: OwnedApplicationWorkflowDependencies,
): (input: {
  userId: string;
  email: string;
  jobId: string;
}) => Promise<OwnedApplicationWorkflowResult> {
  return async function coordinateOwnedApplicationWorkflow(input) {
    let jobLookup: JobLookup;
    let profileLookup: ProfileLookup;
    let versionsLookup: ResumeVersionsLookup;
    try {
      [jobLookup, profileLookup, versionsLookup] = await Promise.all([
        dependencies.getOwnedJob(input),
        dependencies.getOwnedProfile(input),
        dependencies.getOwnedResumeVersions(input),
      ]);
    } catch {
      return { status: "unavailable" };
    }

    if (jobLookup.status !== "ready" || !jobLookup.job) {
      return { status: "unavailable" };
    }

    const resume = resumeState(
      versionsLookup,
      jobLookup.job.id,
      dependencies.parseResumeVersion,
    );
    if (!hasPersistedExtraction(jobLookup.job.extracted)) {
      return {
        status: "ready",
        workflow: {
          analysis: "not_analyzed",
          match: "analysis_required",
          tailoring: "analysis_required",
          resume,
        },
      };
    }

    let parsed: ParseJobExtractionResult;
    try {
      parsed = dependencies.parseExtraction(jobLookup.job.extracted);
    } catch {
      parsed = { status: "invalid", reason: "invalid_structured_output" };
    }
    if (parsed.status !== "valid") {
      return {
        status: "ready",
        workflow: {
          analysis: "unavailable",
          match: "unavailable",
          tailoring: "unavailable",
          resume,
        },
      };
    }

    if (profileLookup.status !== "ready") {
      return {
        status: "ready",
        workflow: {
          analysis: "ready",
          match: "unavailable",
          tailoring: "unavailable",
          resume,
        },
      };
    }

    let match: ReturnType<typeof matchResumeToJob>;
    try {
      match = dependencies.match(
        parsed.canonicalRequirements,
        profileLookup.profile,
      );
    } catch {
      return {
        status: "ready",
        workflow: {
          analysis: "ready",
          match: "unavailable",
          tailoring: "unavailable",
          resume,
        },
      };
    }

    const matchStatus =
      match.status === "insufficient_candidate_data"
        ? "insufficient_profile"
        : match.status;
    let tailoringStatus: ApplicationWorkflowState["tailoring"];
    try {
      const preflight = dependencies.buildPreflight({
        job: jobLookup.job,
        requirements: parsed.canonicalRequirements,
        profile: profileLookup.profile,
        match,
      });
      tailoringStatus =
        preflight.readiness === "insufficient_candidate_data"
          ? "insufficient_profile"
          : preflight.readiness;
    } catch {
      tailoringStatus = "unavailable";
    }
    return {
      status: "ready",
      workflow: {
        analysis: "ready",
        match: matchStatus,
        tailoring: tailoringStatus,
        resume,
      },
    };
  };
}

const productionCoordinator = createOwnedApplicationWorkflowCoordinator({
  async getOwnedJob({ userId, jobId }) {
    const result = await getPrivateJobForWorkflow(userId, jobId);
    return result.status === "ready"
      ? { status: "ready", job: result.data }
      : { status: "unavailable" };
  },
  async getOwnedProfile({ userId, email }) {
    const result = await getMasterProfile(userId, email);
    return result.status === "ready"
      ? { status: "ready", profile: result.data }
      : { status: "unavailable" };
  },
  async getOwnedResumeVersions({ userId, jobId }) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "unavailable" };
    const { data, error } = await supabase
      .from("resume_versions")
      .select("id,job_posting_id,content")
      .eq("user_id", userId)
      .eq("job_posting_id", jobId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (error) return { status: "unavailable" };
    return {
      status: "ready",
      versions: ((data ?? []) as Array<{
        id: string;
        job_posting_id: string | null;
        content: unknown;
      }>).map((version) => ({
        id: version.id,
        jobPostingId: version.job_posting_id,
        content: version.content,
      })),
    };
  },
  parseExtraction: parseJobExtractionOutput,
  match: matchResumeToJob,
  buildPreflight: buildTailoringPreflight,
  parseResumeVersion: parseTailoredResumeVersionContent,
});

export async function getOwnedApplicationWorkflow(input: {
  userId: string;
  email: string;
  jobId: string;
}): Promise<OwnedApplicationWorkflowResult> {
  return productionCoordinator(input);
}
