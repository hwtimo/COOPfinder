"use server";

import { refresh, revalidatePath } from "next/cache";

import { createApplicationFromJob } from "@/lib/applications/create-from-job";
import {
  isApplicationTrackerStatus,
  type ApplicationTrackerStatus,
} from "@/lib/applications/types";
import { updateApplicationStatus } from "@/lib/applications/update-status";
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

export type UpdateApplicationStatusActionResult = {
  status:
    | "updated"
    | "unchanged"
    | "unavailable"
    | "invalid_input"
    | "unconfigured"
    | "unauthenticated"
    | "error";
  message: string;
  applicationId?: string;
  applicationStatus?: ApplicationTrackerStatus;
};

export async function updateApplicationStatusAction(
  applicationId: unknown,
  status: unknown,
): Promise<UpdateApplicationStatusActionResult> {
  if (
    typeof applicationId !== "string" ||
    !isUuid(applicationId) ||
    !isApplicationTrackerStatus(status)
  ) {
    return {
      status: "invalid_input",
      message: "Choose a valid application status before saving.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      message: "Supabase is not configured. The application was not changed.",
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

  const result = await updateApplicationStatus(
    supabase,
    applicationId,
    status,
  );

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      message: "This application is unavailable or is not owned by your account.",
    };
  }

  if (result.status === "unexpected") {
    console.error("Application status RPC failed", {
      code: result.errorCode ?? "invalid_response",
    });
    return {
      status: "error",
      message: "The application status could not be updated. Nothing was changed.",
    };
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  refresh();

  if (result.status === "unchanged") {
    return {
      status: "unchanged",
      message: "The application is already in this status.",
      applicationId: result.applicationId,
      applicationStatus: result.applicationStatus,
    };
  }

  return {
    status: "updated",
    message: "Application status updated.",
    applicationId: result.applicationId,
    applicationStatus: result.applicationStatus,
  };
}
