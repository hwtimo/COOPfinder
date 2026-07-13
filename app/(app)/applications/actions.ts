"use server";

import { refresh, revalidatePath } from "next/cache";

import { createApplicationFromJob } from "@/lib/applications/create-from-job";
import { isUuid } from "@/lib/jobs/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateApplicationActionResult = {
  status:
    | "created"
    | "already_exists"
    | "unavailable"
    | "invalid_input"
    | "unconfigured"
    | "unauthenticated"
    | "error";
  message: string;
  applicationId?: string;
};

export async function createApplicationFromJobAction(
  jobPostingId: unknown,
): Promise<CreateApplicationActionResult> {
  if (typeof jobPostingId !== "string" || !isUuid(jobPostingId)) {
    return {
      status: "invalid_input",
      message: "Choose an available saved job before adding an application.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      message: "Supabase is not configured. No application was created.",
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "unauthenticated",
      message: "Your session has expired. Log in again before continuing.",
    };
  }

  const result = await createApplicationFromJob(supabase, jobPostingId);

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      message: "This saved job is not available for application tracking.",
    };
  }

  if (result.status === "unexpected") {
    console.error("Application creation RPC failed", {
      code: result.errorCode ?? "invalid_response",
    });
    return {
      status: "error",
      message: "The application could not be created. Nothing was added.",
    };
  }

  revalidatePath("/applications");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobPostingId}`);
  refresh();

  if (result.status === "already_exists") {
    return {
      status: "already_exists",
      message: "This saved job is already in your application tracker.",
      applicationId: result.applicationId,
    };
  }

  return {
    status: "created",
    message: "Application tracking started.",
    applicationId: result.applicationId,
  };
}
