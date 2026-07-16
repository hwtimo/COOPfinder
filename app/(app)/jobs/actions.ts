"use server";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLoginHref } from "@/lib/auth/paths";
import {
  createPrivateJobExtractionActionHandler,
  type PrivateJobExtractionActionResult,
} from "@/lib/ai/job-extraction-action-handler";
import { extractAndPersistOwnedJobWithCredits } from "@/lib/ai/parser-analysis-credit-coordinator";
import { getPublicBoardJob } from "@/lib/board/queries";
import {
  EMPTY_PRIVATE_JOB_FORM_VALUES,
  type DeletePrivateJobState,
  type PrivateJobFormValues,
  type PrivateJobMutationState,
  type SaveBoardJobState,
  readPrivateJobFormValues,
  isValidHttpUrl,
  validatePrivateJobFormValues,
} from "@/lib/jobs/forms";
import { getPrivateJobByBoardId, isUuid } from "@/lib/jobs/queries";
import { PRIVATE_JOB_WORK_AUTHORIZATIONS } from "@/lib/jobs/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthenticatedContext = {
  supabase: SupabaseClient;
  user: User;
};

async function getJobsContext(): Promise<AuthenticatedContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/board");
  return { supabase, user };
}

function mutationError(
  values: PrivateJobFormValues,
  message: string,
): PrivateJobMutationState {
  return { status: "error", message, fieldErrors: {}, values };
}

function escapedIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

const handlePrivateJobExtraction = createPrivateJobExtractionActionHandler({
  runBridge: extractAndPersistOwnedJobWithCredits,
  revalidatePath,
});

export async function extractAndPersistPrivateJobAction(
  jobId: string,
): Promise<PrivateJobExtractionActionResult> {
  return handlePrivateJobExtraction(jobId);
}

async function getOrCreateCompany(
  supabase: SupabaseClient,
  userId: string,
  companyName: string,
): Promise<{ id: string } | null> {
  const findCompany = () =>
    supabase
      .from("companies")
      .select("id")
      .ilike("name", escapedIlike(companyName))
      .limit(1)
      .maybeSingle();

  const existing = await findCompany();
  if (existing.data?.id) return { id: existing.data.id };
  if (existing.error) return null;

  const created = await supabase
    .from("companies")
    .insert({ created_by: userId, name: companyName })
    .select("id")
    .single();

  if (created.data?.id) return { id: created.data.id };
  if (created.error?.code !== "23505") return null;

  const raced = await findCompany();
  return raced.data?.id ? { id: raced.data.id } : null;
}

function jobPayload(
  values: PrivateJobFormValues,
  companyId: string,
) {
  return {
    company_id: companyId,
    title: values.title,
    role_type: values.roleType || null,
    location: values.location || null,
    term: values.term || null,
    work_mode: values.workMode || null,
    deadline: values.deadline || null,
    source_url: values.sourceUrl || null,
    raw_text: values.rawText || null,
    status: values.status,
    coop_eligible: values.coopEligible,
    work_authorization: values.workAuthorization || null,
    notes: values.notes || null,
  };
}

export async function createPrivateJobAction(
  _previousState: PrivateJobMutationState,
  formData: FormData,
): Promise<PrivateJobMutationState> {
  const values = readPrivateJobFormValues(formData);
  values.status = "saved";
  const context = await getJobsContext();

  if (!context) {
    return mutationError(
      values,
      "Supabase is not configured for this build. No job was saved.",
    );
  }

  const fieldErrors = validatePrivateJobFormValues(values);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      fieldErrors,
      values,
    };
  }

  const company = await getOrCreateCompany(
    context.supabase,
    context.user.id,
    values.companyName,
  );
  if (!company) {
    return mutationError(values, "The company could not be saved. Try again.");
  }

  const intakeSource = values.rawText
    ? "pasted_text"
    : values.sourceUrl
      ? "pasted_url"
      : "manual";

  const { data, error } = await context.supabase
    .from("job_postings")
    .insert({
      ...jobPayload(values, company.id),
      user_id: context.user.id,
      intake_source: intakeSource,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return mutationError(
      values,
      "The job could not be saved. Nothing was added; please try again.",
    );
  }

  revalidatePath("/jobs");

  return {
    status: "success",
    message: "Job saved to your private list.",
    fieldErrors: {},
    values: EMPTY_PRIVATE_JOB_FORM_VALUES,
    jobId: data.id,
  };
}

export async function updatePrivateJobAction(
  jobId: string,
  _previousState: PrivateJobMutationState,
  formData: FormData,
): Promise<PrivateJobMutationState> {
  const values = readPrivateJobFormValues(formData);
  const context = await getJobsContext();

  if (!context) {
    return mutationError(
      values,
      "Supabase is not configured for this build. No changes were saved.",
    );
  }

  if (!isUuid(jobId)) {
    return mutationError(values, "This private job is no longer available.");
  }

  const fieldErrors = validatePrivateJobFormValues(values);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Review the highlighted fields and try again.",
      fieldErrors,
      values,
    };
  }

  const { data: existing, error: existingError } = await context.supabase
    .from("job_postings")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (existingError || !existing) {
    return mutationError(values, "This private job is no longer available.");
  }

  const company = await getOrCreateCompany(
    context.supabase,
    context.user.id,
    values.companyName,
  );
  if (!company) {
    return mutationError(values, "The company could not be saved. Try again.");
  }

  const { data, error } = await context.supabase
    .from("job_postings")
    .update(jobPayload(values, company.id))
    .eq("id", jobId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return mutationError(
      values,
      "The changes could not be saved. Your previous job details are unchanged.",
    );
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);

  return {
    status: "success",
    message: "Job details updated.",
    fieldErrors: {},
    values,
    jobId,
  };
}

export async function deletePrivateJobAction(
  jobId: string,
  _previousState: DeletePrivateJobState,
  formData: FormData,
): Promise<DeletePrivateJobState> {
  const context = await getJobsContext();
  if (!context) {
    return {
      status: "error",
      message: "Supabase is not configured. Nothing was deleted.",
    };
  }

  if (formData.get("confirmDelete") !== "yes" || !isUuid(jobId)) {
    return {
      status: "error",
      message: "Confirm that you want to delete this private job.",
    };
  }

  const { data: existing, error: existingError } = await context.supabase
    .from("job_postings")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (existingError || !existing) {
    return { status: "error", message: "This private job is no longer available." };
  }

  const { count, error: applicationError } = await context.supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_posting_id", jobId)
    .eq("user_id", context.user.id);

  if (applicationError) {
    return {
      status: "error",
      message: "Linked records could not be checked, so the job was not deleted.",
    };
  }

  if ((count ?? 0) > 0) {
    return {
      status: "error",
      message:
        "This job has a linked application. It was not deleted because that would also remove its application history.",
    };
  }

  const { data, error } = await context.supabase
    .from("job_postings")
    .delete()
    .eq("id", jobId)
    .eq("user_id", context.user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      status: "error",
      message: "The job could not be deleted. Nothing changed; please try again.",
    };
  }

  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function saveBoardJobAction(
  boardJobId: string,
  _previousState: SaveBoardJobState,
): Promise<SaveBoardJobState> {
  void _previousState;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "error",
      message: "Supabase is not configured. No private job was created.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(getLoginHref(`/board/${boardJobId}`, "save_job"));
  }

  const existing = await getPrivateJobByBoardId(user.id, boardJobId);
  if (existing.status === "ready" && existing.data) {
    return {
      status: "success",
      message: "This board role is already in your private jobs.",
      jobId: existing.data.id,
      alreadySaved: true,
    };
  }

  const boardResult = await getPublicBoardJob(boardJobId);
  if (
    boardResult.status !== "ready" ||
    boardResult.source !== "supabase" ||
    !boardResult.data
  ) {
    return {
      status: "error",
      message: "This reviewed board role is not available to save.",
    };
  }

  const boardJob = boardResult.data;
  if (!isValidHttpUrl(boardJob.sourceUrl)) {
    return {
      status: "error",
      message: "The original source URL is invalid, so this role was not saved.",
    };
  }

  const company = await getOrCreateCompany(supabase, user.id, boardJob.companyName);
  if (!company) {
    return { status: "error", message: "The private job could not be saved." };
  }

  const { data, error } = await supabase
    .from("job_postings")
    .insert({
      user_id: user.id,
      company_id: company.id,
      title: boardJob.title,
      location: boardJob.location,
      term: boardJob.term,
      work_mode: boardJob.workMode,
      deadline: boardJob.deadline,
      source_url: boardJob.sourceUrl,
      raw_text: null,
      description: null,
      status: "saved",
      coop_eligible: true,
      work_authorization:
        boardJob.workAuthorization &&
        PRIVATE_JOB_WORK_AUTHORIZATIONS.includes(
          boardJob.workAuthorization as (typeof PRIVATE_JOB_WORK_AUTHORIZATIONS)[number],
        )
          ? boardJob.workAuthorization
          : null,
      intake_source: "board_save",
      board_job_id: boardJob.id,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const raced = await getPrivateJobByBoardId(user.id, boardJobId);
    if (raced.status === "ready" && raced.data) {
      return {
        status: "success",
        message: "This board role is already in your private jobs.",
        jobId: raced.data.id,
        alreadySaved: true,
      };
    }
  }

  if (error || !data?.id) {
    return {
      status: "error",
      message: "The role could not be saved. Nothing was added; please try again.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/board/${boardJobId}`);

  return {
    status: "success",
    message: "Saved to your private jobs without copying an original job description.",
    jobId: data.id,
  };
}
