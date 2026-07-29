"use server";

import { redirect } from "next/navigation";

import {
  INITIAL_MASTER_PROFILE_SAVE_STATE,
  type MasterProfileSaveState,
} from "@/lib/master-profile/types";
import { getMasterProfile } from "@/lib/master-profile/queries";
import {
  extractResumePdf,
  type ResumePdfExtractionResult,
} from "@/lib/resumes/resume-pdf-extraction";
import {
  generateResumeProfileDraft,
  type GenerateResumeProfileDraftResult,
} from "@/lib/resumes/generate-resume-profile-draft";
import { importResumeProfileDraft } from "@/lib/resumes/import-resume-profile-draft";
import type { ResumeProfileDraftV1 } from "@/lib/resumes/resume-profile-draft-contract";
import { getSupabaseUser } from "@/lib/supabase/user";

import { saveMasterProfileAction } from "./master/actions";

export type ResumePdfUploadState =
  | { status: "idle"; message: "" }
  | { status: "error"; message: string }
  | {
      status: "success";
      message: string;
      fileName: string;
      pageCount: number;
      characterCount: number;
      text: string;
      draft:
        | { status: "ready"; value: ResumeProfileDraftV1 }
        | { status: "unavailable"; message: string };
    };

export type ResumeProfileDraftImportState =
  | { status: "idle"; message: "" }
  | { status: "error"; message: string };

function isResumePdfFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      typeof value.name === "string" &&
      "type" in value &&
      typeof value.type === "string" &&
      "size" in value &&
      typeof value.size === "number" &&
      "arrayBuffer" in value &&
      typeof value.arrayBuffer === "function",
  );
}

function messageForFailure(
  status: Exclude<ResumePdfExtractionResult["status"], "success">,
): string {
  if (status === "invalid_file") {
    return "Choose a valid PDF file.";
  }
  if (status === "file_too_large") {
    return "The PDF is larger than 5 MB. Choose a smaller file.";
  }
  if (status === "too_many_pages") {
    return "The PDF has more than 25 pages. Choose a shorter resume file.";
  }
  if (status === "too_much_text") {
    return "The PDF contains too much text to prepare safely.";
  }
  if (status === "encrypted_pdf") {
    return "Password-protected or encrypted PDFs cannot be read. Choose an unlocked PDF.";
  }
  if (status === "no_extractable_text") {
    return "No selectable text was found. Scanned or image-only PDFs are not supported.";
  }
  return "The PDF could not be read. Choose a valid, unencrypted PDF.";
}

function messageForDraftFailure(
  result: Exclude<GenerateResumeProfileDraftResult, { status: "success" }>,
): string {
  if (result.status === "invalid_input" && result.reason === "text_too_long") {
    return "The extracted text is too long to draft safely. The text preview remains available.";
  }
  if (result.status === "configuration_unavailable") {
    return "Profile drafting is temporarily unavailable. The text preview remains available.";
  }
  if (result.status === "provider_refusal") {
    return "A profile draft could not be prepared from this resume. The text preview remains available.";
  }
  if (result.status === "invalid_output") {
    return "The generated draft could not be validated. Nothing was saved or confirmed.";
  }
  return "Profile drafting is temporarily unavailable. Nothing was saved or confirmed.";
}

export async function extractResumePdfAction(
  _previousState: ResumePdfUploadState,
  formData: FormData,
): Promise<ResumePdfUploadState> {
  const user = await getSupabaseUser();
  if (!user) {
    return {
      status: "error",
      message: "Your session has expired. Log in again before uploading.",
    };
  }

  const file = formData.get("resume");
  if (!isResumePdfFile(file)) {
    return { status: "error", message: "Choose a PDF file to continue." };
  }

  const result = await extractResumePdf(file);
  if (result.status !== "success") {
    return { status: "error", message: messageForFailure(result.status) };
  }
  const draftResult = await generateResumeProfileDraft(result.text);

  return {
    status: "success",
    message:
      "Text extracted for review. This PDF and its text have not been saved.",
    fileName: result.fileName,
    pageCount: result.pageCount,
    characterCount: result.characterCount,
    text: result.text,
    draft:
      draftResult.status === "success"
        ? { status: "ready", value: draftResult.draft }
        : {
            status: "unavailable",
            message: messageForDraftFailure(draftResult),
          },
  };
}

export async function importResumeProfileDraftAction(
  _previousState: ResumeProfileDraftImportState,
  formData: FormData,
): Promise<ResumeProfileDraftImportState> {
  const user = await getSupabaseUser();
  if (!user) {
    return {
      status: "error",
      message: "Your session has expired. Log in again before importing.",
    };
  }

  const serializedDraft = formData.get("draft");
  if (typeof serializedDraft !== "string" || serializedDraft.length > 100_000) {
    return {
      status: "error",
      message: "The profile draft is invalid. Upload the resume again.",
    };
  }

  let draft: unknown;
  try {
    draft = JSON.parse(serializedDraft);
  } catch {
    return {
      status: "error",
      message: "The profile draft is invalid. Upload the resume again.",
    };
  }

  const result = await importResumeProfileDraft(
    { id: user.id, email: user.email ?? "" },
    draft,
    {
      loadProfile: getMasterProfile,
      saveProfile: async (payload): Promise<MasterProfileSaveState> =>
        saveMasterProfileAction(INITIAL_MASTER_PROFILE_SAVE_STATE, payload),
    },
  );
  if (result.status !== "success") {
    return {
      status: "error",
      message:
        result.status === "invalid_draft"
          ? "The profile draft is invalid. Upload the resume again."
          : "The draft could not be imported. Your existing profile was not changed.",
    };
  }

  redirect("/resumes/master");
}
