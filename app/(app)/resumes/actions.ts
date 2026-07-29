"use server";

import {
  extractResumePdf,
  type ResumePdfExtractionResult,
} from "@/lib/resumes/resume-pdf-extraction";
import { getSupabaseUser } from "@/lib/supabase/user";

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
    };

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

  return {
    status: "success",
    message:
      "Text extracted for review. This PDF and its text have not been saved.",
    fileName: result.fileName,
    pageCount: result.pageCount,
    characterCount: result.characterCount,
    text: result.text,
  };
}
