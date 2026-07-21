import type { WorkAuthorizationMatch } from "./resume-job-match";

export type OwnedJobMatchSummaryStatus =
  | "comparable"
  | "insufficient_profile"
  | "insufficient_job_data"
  | "invalid_extraction";

export type OwnedJobMatchSummary = Readonly<{
  jobId: string;
  title: string;
  companyName: string | null;
  location: string | null;
  updatedAt: string;
  status: OwnedJobMatchSummaryStatus;
  required: Readonly<{ evidenced: number; total: number }> | null;
  preferred: Readonly<{ evidenced: number; total: number }> | null;
  workAuthorizationStatus: WorkAuthorizationMatch["status"] | null;
  notEvidencedRequiredCount: number | null;
  unassessedRequirementCount: number | null;
}>;

export type OwnedJobMatchesSort =
  | "required_evidence"
  | "missing_required"
  | "recently_updated";

export const OWNED_JOB_MATCH_SORT_OPTIONS: ReadonlyArray<{
  value: OwnedJobMatchesSort;
  label: string;
}> = [
  { value: "required_evidence", label: "Required evidence first" },
  { value: "missing_required", label: "Most missing required evidence" },
  { value: "recently_updated", label: "Recently updated" },
];

function safeDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function stableIdentityOrder(
  left: OwnedJobMatchSummary,
  right: OwnedJobMatchSummary,
) {
  const title = left.title.localeCompare(right.title, "en-CA", {
    sensitivity: "base",
  });
  if (title !== 0) return title;
  const company = (left.companyName ?? "").localeCompare(
    right.companyName ?? "",
    "en-CA",
    { sensitivity: "base" },
  );
  return company !== 0 ? company : left.jobId.localeCompare(right.jobId);
}

function comparableRank(job: OwnedJobMatchSummary) {
  return job.required === null ? 1 : 0;
}

export function sortOwnedJobMatchSummaries(
  jobs: readonly OwnedJobMatchSummary[],
  sort: OwnedJobMatchesSort,
): OwnedJobMatchSummary[] {
  return [...jobs].sort((left, right) => {
    if (sort !== "recently_updated") {
      const rank = comparableRank(left) - comparableRank(right);
      if (rank !== 0) return rank;
    }

    if (sort === "required_evidence") {
      const evidenced =
        (right.required?.evidenced ?? -1) - (left.required?.evidenced ?? -1);
      if (evidenced !== 0) return evidenced;
      const missing =
        (left.notEvidencedRequiredCount ?? Number.MAX_SAFE_INTEGER) -
        (right.notEvidencedRequiredCount ?? Number.MAX_SAFE_INTEGER);
      if (missing !== 0) return missing;
    }

    if (sort === "missing_required") {
      const missing =
        (right.notEvidencedRequiredCount ?? -1) -
        (left.notEvidencedRequiredCount ?? -1);
      if (missing !== 0) return missing;
      const total = (right.required?.total ?? -1) - (left.required?.total ?? -1);
      if (total !== 0) return total;
    }

    const updated = safeDate(right.updatedAt) - safeDate(left.updatedAt);
    if (updated !== 0) return updated;
    return stableIdentityOrder(left, right);
  });
}
