import type { SupabaseClient } from "@supabase/supabase-js";

import { parseTailoredResumeVersionContent } from "@/lib/tailoring/tailored-resume-version-content";
import { parseUserEditedTailoredResumeVersionContent } from "@/lib/tailoring/user-edited-tailored-resume-version";

export type ApplicationResumeVersionCandidate = Readonly<{
  id: string;
  jobPostingId: string | null;
  authorship: string;
  parentVersionId: string | null;
  content: unknown;
  createdAt: string;
}>;

export type PreferredOwnedResumeVersionResult =
  | Readonly<{ status: "ready"; resumeVersionId: string | null }>
  | Readonly<{ status: "unavailable" }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidGeneratedVersion(candidate: ApplicationResumeVersionCandidate) {
  if (
    candidate.authorship !== "ai_generated" ||
    candidate.parentVersionId !== null
  ) {
    return false;
  }
  try {
    return parseTailoredResumeVersionContent(candidate.content).status === "valid";
  } catch {
    return false;
  }
}

function isValidEditedVersion(
  candidate: ApplicationResumeVersionCandidate,
  validGeneratedVersions: ReadonlySet<string>,
) {
  if (
    candidate.authorship !== "user_authored" ||
    !candidate.parentVersionId ||
    !validGeneratedVersions.has(candidate.parentVersionId)
  ) {
    return false;
  }
  try {
    const parsed = parseUserEditedTailoredResumeVersionContent(candidate.content);
    return (
      parsed.status === "valid" &&
      parsed.content.parentVersionId === candidate.parentVersionId
    );
  } catch {
    return false;
  }
}

function compareCandidates(
  left: ApplicationResumeVersionCandidate,
  right: ApplicationResumeVersionCandidate,
) {
  const createdDifference =
    Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (createdDifference !== 0) return createdDifference;

  if (left.authorship !== right.authorship) {
    return left.authorship === "user_authored" ? -1 : 1;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function selectPreferredApplicationResumeVersion(
  jobId: string,
  candidates: readonly ApplicationResumeVersionCandidate[],
): string | null {
  const sameJobCandidates = candidates.filter(
    (candidate) =>
      UUID_PATTERN.test(candidate.id) &&
      candidate.jobPostingId === jobId &&
      Number.isFinite(Date.parse(candidate.createdAt)),
  );
  const validGeneratedVersions = new Set(
    sameJobCandidates
      .filter(isValidGeneratedVersion)
      .map((candidate) => candidate.id),
  );
  const eligible = sameJobCandidates.filter(
    (candidate) =>
      validGeneratedVersions.has(candidate.id) ||
      isValidEditedVersion(candidate, validGeneratedVersions),
  );

  return [...eligible].sort(compareCandidates)[0]?.id ?? null;
}

export async function getPreferredOwnedResumeVersionForJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
): Promise<PreferredOwnedResumeVersionResult> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select(
      "id,job_posting_id,authorship,parent_version_id,content,created_at",
    )
    .eq("user_id", userId)
    .eq("job_posting_id", jobId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (error) return { status: "unavailable" };

  const candidates = (data ?? []).map((candidate) => ({
    id: candidate.id,
    jobPostingId: candidate.job_posting_id,
    authorship: candidate.authorship,
    parentVersionId: candidate.parent_version_id,
    content: candidate.content,
    createdAt: candidate.created_at,
  }));
  return {
    status: "ready",
    resumeVersionId: selectPreferredApplicationResumeVersion(jobId, candidates),
  };
}
