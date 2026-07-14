"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createApplicationFromJob } from "@/lib/applications/create-from-job";
import { deleteApplication } from "@/lib/applications/delete-application";
import {
  isIsoCalendarDate,
  updateApplicationDeadline,
} from "@/lib/applications/update-deadline";
import {
  isIsoTimestampWithTimezone,
  updateApplicationFollowUp,
} from "@/lib/applications/update-follow-up";
import {
  APPLICATION_NOTES_MAX_LENGTH,
  updateApplicationNotes,
} from "@/lib/applications/update-notes";
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

export type UpdateApplicationNotesActionResult = {
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
  notes?: string | null;
};

export async function updateApplicationNotesAction(
  applicationId: unknown,
  notes: unknown,
): Promise<UpdateApplicationNotesActionResult> {
  if (typeof applicationId !== "string" || !isUuid(applicationId)) {
    return {
      status: "invalid_input",
      message: "Choose a valid application before saving notes.",
    };
  }

  if (
    typeof notes !== "string" ||
    notes.length > APPLICATION_NOTES_MAX_LENGTH
  ) {
    return {
      status: "invalid_input",
      message: `Notes must be ${APPLICATION_NOTES_MAX_LENGTH.toLocaleString("en-CA")} characters or fewer.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      message: "Supabase is not configured. The notes were not changed.",
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

  const result = await updateApplicationNotes(supabase, applicationId, notes);

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      message: "This application is unavailable or is not owned by your account.",
    };
  }

  if (result.status === "unexpected") {
    console.error("Application notes RPC failed", {
      code: result.errorCode ?? "invalid_response",
    });
    return {
      status: "error",
      message: "The application notes could not be saved. Nothing was changed.",
    };
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  refresh();

  if (result.status === "unchanged") {
    return {
      status: "unchanged",
      message: "These application notes are already saved.",
      applicationId: result.applicationId,
      notes: result.notes,
    };
  }

  return {
    status: "updated",
    message: result.notes === null ? "Application notes cleared." : "Application notes saved.",
    applicationId: result.applicationId,
    notes: result.notes,
  };
}

export type UpdateApplicationDeadlineActionResult = {
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
  deadline?: string | null;
};

export async function updateApplicationDeadlineAction(
  applicationId: unknown,
  deadline: unknown,
): Promise<UpdateApplicationDeadlineActionResult> {
  if (typeof applicationId !== "string" || !isUuid(applicationId)) {
    return {
      status: "invalid_input",
      message: "Choose a valid application before saving a deadline.",
    };
  }

  if (
    typeof deadline !== "string" ||
    (deadline !== "" && !isIsoCalendarDate(deadline))
  ) {
    return {
      status: "invalid_input",
      message: "Enter a valid calendar date in YYYY-MM-DD format, or clear the field.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      message: "Supabase is not configured. The deadline was not changed.",
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

  const result = await updateApplicationDeadline(
    supabase,
    applicationId,
    deadline === "" ? null : deadline,
  );

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      message: "This application is unavailable or is not owned by your account.",
    };
  }

  if (result.status === "unexpected") {
    console.error("Application deadline RPC failed", {
      code: result.errorCode ?? "invalid_response",
    });
    return {
      status: "error",
      message: "The application deadline could not be saved. Nothing was changed.",
    };
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  refresh();

  if (result.status === "unchanged") {
    return {
      status: "unchanged",
      message:
        result.deadline === null
          ? "This application deadline is already clear."
          : "This application deadline is already saved.",
      applicationId: result.applicationId,
      deadline: result.deadline,
    };
  }

  return {
    status: "updated",
    message:
      result.deadline === null
        ? "Application deadline cleared."
        : "Application deadline saved.",
    applicationId: result.applicationId,
    deadline: result.deadline,
  };
}

export type UpdateApplicationFollowUpActionResult = {
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
  followUpDue?: string | null;
};

export async function updateApplicationFollowUpAction(
  applicationId: unknown,
  followUpDue: unknown,
): Promise<UpdateApplicationFollowUpActionResult> {
  if (typeof applicationId !== "string" || !isUuid(applicationId)) {
    return {
      status: "invalid_input",
      message: "Choose a valid application before saving a follow-up.",
    };
  }

  if (
    typeof followUpDue !== "string" ||
    (followUpDue !== "" && !isIsoTimestampWithTimezone(followUpDue))
  ) {
    return {
      status: "invalid_input",
      message:
        "Enter a valid ISO timestamp with a timezone, or clear the field.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      message: "Supabase is not configured. The follow-up was not changed.",
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

  const result = await updateApplicationFollowUp(
    supabase,
    applicationId,
    followUpDue === "" ? null : followUpDue,
  );

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      message: "This application is unavailable or is not owned by your account.",
    };
  }

  if (result.status === "unexpected") {
    console.error("Application follow-up RPC failed", {
      code: result.errorCode ?? "invalid_response",
    });
    return {
      status: "error",
      message: "The application follow-up could not be saved. Nothing was changed.",
    };
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  refresh();

  if (result.status === "unchanged") {
    return {
      status: "unchanged",
      message:
        result.followUpDue === null
          ? "This application follow-up is already clear."
          : "This application follow-up is already saved.",
      applicationId: result.applicationId,
      followUpDue: result.followUpDue,
    };
  }

  return {
    status: "updated",
    message:
      result.followUpDue === null
        ? "Application follow-up cleared."
        : "Application follow-up saved.",
    applicationId: result.applicationId,
    followUpDue: result.followUpDue,
  };
}

export type DeleteApplicationActionResult = {
  status:
    | "deleted"
    | "unavailable"
    | "invalid_input"
    | "unconfigured"
    | "unauthenticated"
    | "error";
  message: string;
  applicationId?: string;
};

export async function deleteApplicationAction(
  applicationId: unknown,
): Promise<DeleteApplicationActionResult> {
  if (typeof applicationId !== "string" || !isUuid(applicationId)) {
    return {
      status: "invalid_input",
      message: "Choose a valid application before deleting it.",
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      status: "unconfigured",
      message: "Supabase is not configured. The application was not deleted.",
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

  const result = await deleteApplication(supabase, applicationId);

  if (result.status === "unavailable") {
    return {
      status: "unavailable",
      message: "This application is unavailable or is not owned by your account.",
    };
  }

  if (result.status === "unexpected") {
    console.error("Application deletion RPC failed", {
      code: result.errorCode ?? "invalid_response",
    });
    return {
      status: "error",
      message: "The application could not be deleted. Nothing was removed.",
    };
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  redirect("/applications");
}
