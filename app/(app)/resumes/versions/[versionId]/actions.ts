"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLoginHref } from "@/lib/auth/paths";
import { createOwnedUserEditedTailoredResumeVersion } from "@/lib/tailoring/create-owned-user-edited-tailored-resume-version";
import { userEditedTailoredResumeInputV1Schema } from "@/lib/tailoring/user-edited-tailored-resume-input";

export type SaveUserEditedResumeVersionState =
  | Readonly<{ status: "idle"; message: "" }>
  | Readonly<{ status: "error"; message: string }>;

const MAX_SERIALIZED_EDIT_LENGTH = 250_000;

export async function saveUserEditedResumeVersionAction(
  parentVersionId: string,
  _previousState: SaveUserEditedResumeVersionState,
  formData: FormData,
): Promise<SaveUserEditedResumeVersionState> {
  void _previousState;
  const serialized = formData.get("edit");
  if (
    typeof serialized !== "string" ||
    serialized.length === 0 ||
    serialized.length > MAX_SERIALIZED_EDIT_LENGTH
  ) {
    return {
      status: "error",
      message: "The edited resume is invalid. Review the bullets and try again.",
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return {
      status: "error",
      message: "The edited resume is invalid. Review the bullets and try again.",
    };
  }
  const parsed = userEditedTailoredResumeInputV1Schema.safeParse(value);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Keep at least one non-empty bullet and review each bullet before saving.",
    };
  }

  const result = await createOwnedUserEditedTailoredResumeVersion(
    parentVersionId,
    parsed.data,
  );
  if (result.status === "unauthenticated") {
    redirect(getLoginHref(`/resumes/versions/${parentVersionId}`));
  }
  if (result.status === "created") {
    revalidatePath("/resumes");
    redirect(`/resumes/versions/${result.resumeVersionId}`);
  }
  if (result.status === "invalid_document") {
    return {
      status: "error",
      message:
        "Keep at least one non-empty bullet and review each bullet before saving.",
    };
  }
  if (result.status === "not_found" || result.status === "invalid_parent") {
    return {
      status: "error",
      message: "This generated resume is unavailable for editing.",
    };
  }
  return {
    status: "error",
    message: "The edited resume could not be saved. Please try again.",
  };
}
