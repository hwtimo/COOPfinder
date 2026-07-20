import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseUser } from "@/lib/supabase/user";

import {
  buildTailoringGeneratedContentReviewViewModel,
  parseTailoringGeneratedContent,
  type TailoringGeneratedContentReviewViewModel,
} from "./tailoring-generated-content";
import {
  buildTailoredResumeDocumentReviewViewModel,
  parseTailoredResumeVersionContent,
  type TailoredResumeDocumentReviewViewModel,
} from "./tailored-resume-version-content";

type ResumeVersionRow = Readonly<{
  id: string;
  name: string;
  content: unknown;
  jobPostingId: string | null;
}>;

type OwnedVersionLookup =
  | Readonly<{ status: "ready"; version: ResumeVersionRow | null }>
  | Readonly<{ status: "unavailable" }>;

export type GetOwnedTailoredResumeVersionDependencies = Readonly<{
  getAuthenticatedUser: () => Promise<Readonly<{ id: string }> | null>;
  getOwnedVersion: (input: {
    versionId: string;
    userId: string;
  }) => Promise<OwnedVersionLookup>;
}>;

export type GetOwnedTailoredResumeVersionResult =
  | Readonly<{
      status: "ready";
      resumeVersionId: string;
      versionName: string;
      review:
        | TailoredResumeDocumentReviewViewModel
        | TailoringGeneratedContentReviewViewModel;
    }>
  | Readonly<{ status: "legacy_content_unavailable" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "invalid_content" }>
  | Readonly<{ status: "unavailable" }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isSafeVersionName(value: string) {
  return (
    value.length > 0 &&
    value.length <= 240 &&
    value.replace(/\s+/g, " ").trim() === value
  );
}

export function createGetOwnedTailoredResumeVersionLoader(
  dependencies: GetOwnedTailoredResumeVersionDependencies,
): (versionId: string) => Promise<GetOwnedTailoredResumeVersionResult> {
  return async function loadOwnedTailoredResumeVersion(versionId) {
    let user: Readonly<{ id: string }> | null;
    try {
      user = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unavailable" };
    }
    if (!user) return { status: "unauthenticated" };
    if (!UUID_PATTERN.test(versionId)) return { status: "not_found" };

    let lookup: OwnedVersionLookup;
    try {
      lookup = await dependencies.getOwnedVersion({
        versionId,
        userId: user.id,
      });
    } catch {
      return { status: "unavailable" };
    }
    if (lookup.status !== "ready") return { status: "unavailable" };
    if (!lookup.version || !lookup.version.jobPostingId) {
      return { status: "not_found" };
    }
    if (
      lookup.version.id !== versionId ||
      !isSafeVersionName(lookup.version.name)
    ) {
      return { status: "invalid_content" };
    }

    const documentContent = parseTailoredResumeVersionContent(
      lookup.version.content,
    );
    if (documentContent.status === "valid") {
      return {
        status: "ready",
        resumeVersionId: lookup.version.id,
        versionName: lookup.version.name,
        review: buildTailoredResumeDocumentReviewViewModel(
          documentContent.content,
        ),
      };
    }

    const parsed = parseTailoringGeneratedContent(lookup.version.content);
    if (parsed.status === "legacy_content_unavailable") {
      return { status: "legacy_content_unavailable" };
    }
    if (parsed.status !== "valid") return { status: "invalid_content" };
    const review = buildTailoringGeneratedContentReviewViewModel(parsed.content);
    if (review.status !== "ready") return { status: "invalid_content" };

    return {
      status: "ready",
      resumeVersionId: lookup.version.id,
      versionName: lookup.version.name,
      review: review.viewModel,
    };
  };
}

const productionLoader = createGetOwnedTailoredResumeVersionLoader({
  async getAuthenticatedUser() {
    const user = await getSupabaseUser();
    return user ? { id: user.id } : null;
  },
  async getOwnedVersion({ versionId, userId }) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { status: "unavailable" };
    const { data, error } = await supabase
      .from("resume_versions")
      .select("id,name,content,job_posting_id")
      .eq("id", versionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { status: "unavailable" };
    return {
      status: "ready",
      version: data
        ? {
            id: data.id,
            name: data.name,
            content: data.content,
            jobPostingId: data.job_posting_id,
          }
        : null,
    };
  },
});

export async function getOwnedTailoredResumeVersion(
  versionId: string,
): Promise<GetOwnedTailoredResumeVersionResult> {
  return productionLoader(versionId);
}
