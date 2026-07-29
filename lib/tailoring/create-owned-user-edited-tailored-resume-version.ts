import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseUser } from "@/lib/supabase/user";

import {
  buildUserEditedTailoredResumeVersion,
  type UserEditedTailoredResumeVersionContentV1,
} from "./user-edited-tailored-resume-version";
import type { UserEditedTailoredResumeInputV1 } from "./user-edited-tailored-resume-input";

type ParentVersionRow = Readonly<{
  id: string;
  name: string;
  jobPostingId: string | null;
  content: unknown;
  authorship: string;
  parentVersionId: string | null;
}>;

type ChildVersionInsert = Readonly<{
  userId: string;
  jobPostingId: string;
  parentVersionId: string;
  name: string;
  baseVersionName: string;
  content: UserEditedTailoredResumeVersionContentV1;
}>;

type PersistenceResult =
  | Readonly<{ status: "created"; id: string; name: string }>
  | Readonly<{ status: "unavailable" }>;

export type CreateOwnedUserEditedTailoredResumeVersionDependencies = Readonly<{
  getAuthenticatedUser: () => Promise<Readonly<{ id: string }> | null>;
  getOwnedParentVersion: (input: {
    parentVersionId: string;
    userId: string;
  }) => Promise<ParentVersionRow | null | "unavailable">;
  insertChildVersion: (input: ChildVersionInsert) => Promise<PersistenceResult>;
}>;

export type CreateOwnedUserEditedTailoredResumeVersionResult =
  | Readonly<{
      status: "created";
      resumeVersionId: string;
      versionName: string;
    }>
  | Readonly<{
      status:
        | "unauthenticated"
        | "not_found"
        | "invalid_parent"
        | "invalid_document"
        | "unavailable";
    }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function editedVersionName(parentName: string) {
  const suffix = " - edited";
  return `${parentName.slice(0, 240 - suffix.length).trimEnd()}${suffix}`;
}

export function createOwnedUserEditedTailoredResumeVersionCoordinator(
  dependencies: CreateOwnedUserEditedTailoredResumeVersionDependencies,
): (
  parentVersionId: string,
  input: UserEditedTailoredResumeInputV1,
) => Promise<CreateOwnedUserEditedTailoredResumeVersionResult> {
  return async function createEditedVersion(parentVersionId, input) {
    let user: Readonly<{ id: string }> | null;
    try {
      user = await dependencies.getAuthenticatedUser();
    } catch {
      return { status: "unavailable" };
    }
    if (!user) return { status: "unauthenticated" };
    if (!UUID_PATTERN.test(parentVersionId)) return { status: "not_found" };

    let parent: ParentVersionRow | null | "unavailable";
    try {
      parent = await dependencies.getOwnedParentVersion({
        parentVersionId,
        userId: user.id,
      });
    } catch {
      return { status: "unavailable" };
    }
    if (parent === "unavailable") return { status: "unavailable" };
    if (!parent) return { status: "not_found" };
    if (
      parent.id !== parentVersionId ||
      !parent.jobPostingId ||
      parent.authorship !== "ai_generated" ||
      parent.parentVersionId !== null
    ) {
      return { status: "invalid_parent" };
    }

    const built = buildUserEditedTailoredResumeVersion(
      parentVersionId,
      parent.content,
      input,
    );
    if (built.status !== "success") return built;

    let persisted: PersistenceResult;
    try {
      persisted = await dependencies.insertChildVersion({
        userId: user.id,
        jobPostingId: parent.jobPostingId,
        parentVersionId,
        name: editedVersionName(parent.name),
        baseVersionName: parent.name,
        content: built.content,
      });
    } catch {
      return { status: "unavailable" };
    }
    return persisted.status === "created"
      ? {
          status: "created",
          resumeVersionId: persisted.id,
          versionName: persisted.name,
        }
      : { status: "unavailable" };
  };
}

const productionCoordinator =
  createOwnedUserEditedTailoredResumeVersionCoordinator({
    async getAuthenticatedUser() {
      const user = await getSupabaseUser();
      return user ? { id: user.id } : null;
    },
    async getOwnedParentVersion({ parentVersionId, userId }) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) return "unavailable";
      const { data, error } = await supabase
        .from("resume_versions")
        .select(
          "id,name,job_posting_id,content,authorship,parent_version_id",
        )
        .eq("id", parentVersionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return "unavailable";
      return data
        ? {
            id: data.id,
            name: data.name,
            jobPostingId: data.job_posting_id,
            content: data.content,
            authorship: data.authorship,
            parentVersionId: data.parent_version_id,
          }
        : null;
    },
    async insertChildVersion(input) {
      const supabase = createSupabaseAdminClient();
      if (!supabase) return { status: "unavailable" };
      const { data, error } = await supabase
        .from("resume_versions")
        .insert({
          user_id: input.userId,
          job_posting_id: input.jobPostingId,
          parent_version_id: input.parentVersionId,
          authorship: "user_authored",
          name: input.name,
          focus: "User-edited version",
          base_version_name: input.baseVersionName,
          content: input.content,
          keyword_report: {},
          notes: null,
        })
        .select("id,name")
        .single();
      return error || !data
        ? { status: "unavailable" }
        : { status: "created", id: data.id, name: data.name };
    },
  });

export async function createOwnedUserEditedTailoredResumeVersion(
  parentVersionId: string,
  input: UserEditedTailoredResumeInputV1,
): Promise<CreateOwnedUserEditedTailoredResumeVersionResult> {
  return productionCoordinator(parentVersionId, input);
}
