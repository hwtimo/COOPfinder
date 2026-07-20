import "server-only";

import {
  getOwnedJobMatchContext,
  type OwnedJobMatchContextResult,
} from "@/lib/matching/get-owned-job-match";

import {
  buildTailoringPreflight,
  type BuildTailoringPreflightInput,
  type TailoringPreflightPackage,
} from "./tailoring-preflight";

export type OwnedTailoringPreflightResult =
  | {
      status:
        | "ready"
        | "insufficient_job_data"
        | "insufficient_candidate_data";
      preflight: TailoringPreflightPackage;
    }
  | { status: "unauthenticated" }
  | { status: "not_found" }
  | { status: "extraction_unavailable" }
  | { status: "profile_unavailable" }
  | { status: "invalid_extraction" }
  | { status: "unavailable" };

export type OwnedTailoringPreflightDependencies = Readonly<{
  getOwnedMatchContext: (
    jobId: string,
  ) => Promise<OwnedJobMatchContextResult>;
  buildPreflight: (
    input: BuildTailoringPreflightInput,
  ) => TailoringPreflightPackage;
}>;

export function createOwnedTailoringPreflightCoordinator(
  dependencies: OwnedTailoringPreflightDependencies,
): (jobId: string) => Promise<OwnedTailoringPreflightResult> {
  return async function coordinateOwnedTailoringPreflight(jobId) {
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
      return { status: preflight.readiness, preflight };
    } catch {
      return { status: "unavailable" };
    }
  };
}

const productionCoordinator = createOwnedTailoringPreflightCoordinator({
  getOwnedMatchContext: getOwnedJobMatchContext,
  buildPreflight: buildTailoringPreflight,
});

export async function getOwnedTailoringPreflight(
  jobId: string,
): Promise<OwnedTailoringPreflightResult> {
  return productionCoordinator(jobId);
}
