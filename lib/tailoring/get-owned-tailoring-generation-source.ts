import "server-only";

import {
  getOwnedJobMatchContext,
  type OwnedJobMatchContextResult,
} from "@/lib/matching/get-owned-job-match";

import {
  buildResumeSourceSnapshot,
  type ResumeSourceSnapshot,
} from "./resume-source-snapshot";
import {
  buildTailoringPreflight,
  type BuildTailoringPreflightInput,
  type TailoringPreflightPackage,
} from "./tailoring-preflight";

export type OwnedTailoringGenerationSourceResult =
  | Readonly<{
      status: "ready";
      preflight: TailoringPreflightPackage;
      resumeSourceSnapshot: ResumeSourceSnapshot;
    }>
  | Readonly<{
      status: "insufficient_job_data" | "insufficient_candidate_data";
    }>
  | Exclude<OwnedJobMatchContextResult, { status: "matched" }>;

export type OwnedTailoringGenerationSourceDependencies = Readonly<{
  getOwnedMatchContext: (
    jobId: string,
  ) => Promise<OwnedJobMatchContextResult>;
  buildPreflight: (
    input: BuildTailoringPreflightInput,
  ) => TailoringPreflightPackage;
  buildSnapshot: typeof buildResumeSourceSnapshot;
}>;

export function createOwnedTailoringGenerationSourceCoordinator(
  dependencies: OwnedTailoringGenerationSourceDependencies,
): (jobId: string) => Promise<OwnedTailoringGenerationSourceResult> {
  return async function getGenerationSource(jobId) {
    let context: OwnedJobMatchContextResult;
    try {
      context = await dependencies.getOwnedMatchContext(jobId);
    } catch {
      return { status: "unavailable" };
    }
    if (context.status !== "matched") return context;

    try {
      const preflight = dependencies.buildPreflight({
        job: context.job,
        requirements: context.canonicalRequirements,
        profile: context.profile,
        match: context.match,
      });
      if (preflight.readiness !== "ready") {
        return { status: preflight.readiness };
      }
      const snapshot = dependencies.buildSnapshot(context.profile);
      if (snapshot.status !== "ready") return { status: "profile_unavailable" };
      const approvedFragments = snapshot.snapshot.entries.reduce(
        (total, entry) => total + entry.fragments.length,
        0,
      );
      if (approvedFragments === 0) {
        return { status: "insufficient_candidate_data" };
      }
      return {
        status: "ready",
        preflight,
        resumeSourceSnapshot: snapshot.snapshot,
      };
    } catch {
      return { status: "unavailable" };
    }
  };
}

const productionCoordinator =
  createOwnedTailoringGenerationSourceCoordinator({
    getOwnedMatchContext: getOwnedJobMatchContext,
    buildPreflight: buildTailoringPreflight,
    buildSnapshot: buildResumeSourceSnapshot,
  });

export async function getOwnedTailoringGenerationSource(
  jobId: string,
): Promise<OwnedTailoringGenerationSourceResult> {
  return productionCoordinator(jobId);
}
