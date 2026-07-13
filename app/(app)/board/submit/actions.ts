"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLoginHref } from "@/lib/auth/paths";
import {
  EMPTY_BOARD_SUBMISSION_VALUES,
  type BoardSubmissionActionState,
  type BoardSubmissionField,
  type BoardSubmissionFormValues,
} from "@/lib/board/submission-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const WORK_MODES = new Set(["Remote", "Hybrid", "On-site"]);

function formValue(formData: FormData, name: BoardSubmissionField): string {
  return String(formData.get(name) ?? "").trim();
}

function readValues(formData: FormData): BoardSubmissionFormValues {
  return {
    sourceUrl: formValue(formData, "sourceUrl"),
    title: formValue(formData, "title"),
    companyName: formValue(formData, "companyName"),
    location: formValue(formData, "location"),
    term: formValue(formData, "term"),
    workMode: formValue(formData, "workMode"),
    deadline: formValue(formData, "deadline"),
    keywords: formValue(formData, "keywords"),
    submissionNote: formValue(formData, "submissionNote"),
    rawText: formValue(formData, "rawText"),
  };
}

function validHttpUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateValues(values: BoardSubmissionFormValues) {
  const fieldErrors: Partial<Record<BoardSubmissionField, string>> = {};

  if (!validHttpUrl(values.sourceUrl)) {
    fieldErrors.sourceUrl = "Enter a valid http or https posting URL.";
  }
  if (!values.title || values.title.length > 200) {
    fieldErrors.title = "Enter a title between 1 and 200 characters.";
  }
  if (!values.companyName || values.companyName.length > 160) {
    fieldErrors.companyName = "Enter a company between 1 and 160 characters.";
  }
  if (values.location.length > 160) {
    fieldErrors.location = "Keep the location to 160 characters or fewer.";
  }
  if (values.term.length > 120) {
    fieldErrors.term = "Keep the term to 120 characters or fewer.";
  }
  if (values.workMode && !WORK_MODES.has(values.workMode)) {
    fieldErrors.workMode = "Choose a listed work mode.";
  }
  if (values.deadline && !validDate(values.deadline)) {
    fieldErrors.deadline = "Enter a valid deadline.";
  }
  if (values.submissionNote.length > 2000) {
    fieldErrors.submissionNote = "Keep the note to 2,000 characters or fewer.";
  }
  if (values.rawText.length > 100000) {
    fieldErrors.rawText = "Keep the pasted description to 100,000 characters or fewer.";
  }

  const keywords = values.keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  if (keywords.length > 20) {
    fieldErrors.keywords = "Use no more than 20 comma-separated skills or tags.";
  } else if (keywords.some((keyword) => keyword.length > 80)) {
    fieldErrors.keywords = "Keep each skill or tag to 80 characters or fewer.";
  }

  return { fieldErrors, keywords: [...new Set(keywords)] };
}

type SubmissionRpcRow = {
  board_job_id: string;
  job_posting_id: string;
  moderation_status: string;
};

export async function submitBoardJobAction(
  _previousState: BoardSubmissionActionState,
  formData: FormData,
): Promise<BoardSubmissionActionState> {
  const values = readValues(formData);
  const { fieldErrors, keywords } = validateValues(values);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      fieldErrors,
      values,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      status: "error",
      message:
        "Supabase is not configured for this build. No submission was saved.",
      fieldErrors: {},
      values,
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(getLoginHref("/board/submit", "submit_board_job"));
  }

  const { data, error } = await supabase.rpc(
    "submit_board_job_with_private_copy",
    {
      p_source_url: values.sourceUrl,
      p_title: values.title,
      p_company_name: values.companyName,
      p_location: values.location || null,
      p_term: values.term || null,
      p_work_mode: values.workMode || null,
      p_deadline: values.deadline || null,
      p_keywords: keywords,
      p_note: values.submissionNote || null,
      p_raw_text: values.rawText || null,
    },
  );

  if (error) {
    console.error("Board submission RPC failed", {
      code: error.code,
      message: error.message,
    });
    return {
      status: "error",
      message:
        "The role could not be submitted. Nothing was saved; please try again.",
      fieldErrors: {},
      values,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | SubmissionRpcRow
    | null;

  if (
    !row?.board_job_id ||
    !row.job_posting_id ||
    row.moderation_status !== "pending_review"
  ) {
    return {
      status: "error",
      message:
        "The submission response was incomplete. Refresh before trying again.",
      fieldErrors: {},
      values,
    };
  }

  revalidatePath("/board/submit");

  return {
    status: "success",
    message: "Your role was saved privately and submitted for review.",
    fieldErrors: {},
    values: EMPTY_BOARD_SUBMISSION_VALUES,
    result: {
      boardJobId: row.board_job_id,
      jobPostingId: row.job_posting_id,
      moderationStatus: "pending_review",
    },
  };
}
