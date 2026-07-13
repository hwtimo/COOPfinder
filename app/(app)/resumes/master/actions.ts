"use server";

import { revalidatePath } from "next/cache";

import {
  canonicalizeGuestDraft,
  guestDraftHasValue,
  normalizeGuestDraft,
} from "@/lib/guest-draft/normalize";
import type {
  GuestImportRequest,
  GuestImportState,
  MasterProfileSaveState,
} from "@/lib/master-profile/types";
import { validateMasterProfilePayload } from "@/lib/master-profile/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ImportRpcRow = {
  result_status: string;
  draft_hash: string;
  imported_profile_fields: number;
  imported_skills: number;
  imported_entries: number;
  imported_jobs: number;
  skipped_entries: number;
  skipped_jobs: number;
};

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "unconfigured" as const };

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { status: "unauthenticated" as const };
  return { status: "ready" as const, supabase };
}

export async function saveMasterProfileAction(
  _previousState: MasterProfileSaveState,
  payload: unknown,
): Promise<MasterProfileSaveState> {
  const validation = validateMasterProfilePayload(payload);
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  const context = await authenticatedClient();
  if (context.status === "unconfigured") {
    return {
      status: "error",
      message: "Supabase is not configured. No profile changes were saved.",
    };
  }
  if (context.status === "unauthenticated") {
    return {
      status: "error",
      message: "Your session has expired. Log in again before saving.",
    };
  }

  const { data, error } = await context.supabase.rpc("save_master_profile", {
    p_profile: {
      fullName: validation.data.fullName,
      school: validation.data.school,
      program: validation.data.program,
      gradYear: validation.data.gradYear,
      coopTerm: validation.data.coopTerm,
      workAuthorization: validation.data.workAuthorization,
      preferredLocations: validation.data.preferredLocations,
      targetRoles: validation.data.targetRoles,
    },
    p_skills: validation.data.skills,
    p_entries: validation.data.entries.map((entry) => ({
      section: entry.section,
      source: entry.source,
      text: entry.text,
      skills: entry.skills,
      confirmed: entry.confirmed,
    })),
  });

  const row = (Array.isArray(data) ? data[0] : data) as
    | { saved_entries: number }
    | null;
  if (error || !row || typeof row.saved_entries !== "number") {
    console.error("Master Profile save RPC failed", {
      code: error?.code,
      message: error?.message,
    });
    return {
      status: "error",
      message:
        "The profile could not be saved. Your entered changes are still on this page.",
    };
  }

  revalidatePath("/resumes/master");
  return {
    status: "success",
    message: `Master profile saved with ${row.saved_entries} ${row.saved_entries === 1 ? "entry" : "entries"}.`,
  };
}

export async function importGuestDraftAction(
  _previousState: GuestImportState,
  request: GuestImportRequest,
): Promise<GuestImportState> {
  if (!request || (request.mode !== "auto" && request.mode !== "merge")) {
    return { status: "error", message: "The import request is invalid.", complete: false };
  }

  const draft = normalizeGuestDraft(request.draft);
  if (!draft || !guestDraftHasValue(draft)) {
    return {
      status: "error",
      message: "The device draft is empty or invalid. Nothing was imported.",
      complete: false,
    };
  }
  const canonicalDraft = canonicalizeGuestDraft(draft);
  if (!canonicalDraft) {
    return {
      status: "error",
      message: "A saved job URL is invalid. Review the draft on Start before importing.",
      complete: false,
    };
  }

  const context = await authenticatedClient();
  if (context.status === "unconfigured") {
    return {
      status: "error",
      message: "Supabase is not configured. The device draft was not imported.",
      complete: false,
    };
  }
  if (context.status === "unauthenticated") {
    return {
      status: "error",
      message: "Your session has expired. The device draft remains on this device.",
      complete: false,
    };
  }

  const { data, error } = await context.supabase.rpc("import_guest_draft", {
    p_draft: canonicalDraft,
    p_mode: request.mode,
  });
  const row = (Array.isArray(data) ? data[0] : data) as ImportRpcRow | null;
  if (
    error ||
    !row?.draft_hash ||
    !["imported", "already_imported", "needs_confirmation"].includes(
      row.result_status,
    )
  ) {
    console.error("Guest draft import RPC failed", {
      code: error?.code,
      message: error?.message,
    });
    return {
      status: "error",
      message: "The device draft could not be imported. Nothing was cleared.",
      complete: false,
    };
  }

  if (row.result_status === "needs_confirmation") {
    return {
      status: "needs_confirmation",
      message: "This account already has saved information. Choose whether to merge the device draft.",
      complete: false,
      draftHash: row.draft_hash,
      normalizedUpdatedAt: draft.updatedAt,
    };
  }

  const counts = {
    profileFields: row.imported_profile_fields,
    skills: row.imported_skills,
    entries: row.imported_entries,
    jobs: row.imported_jobs,
    skippedEntries: row.skipped_entries,
    skippedJobs: row.skipped_jobs,
  };
  const alreadyImported = row.result_status === "already_imported";

  revalidatePath("/resumes/master");
  revalidatePath("/jobs");
  return {
    status: alreadyImported ? "already_imported" : "imported",
    message: alreadyImported
      ? "This device draft was already imported."
      : `Imported ${counts.profileFields} profile fields, ${counts.skills} skills, ${counts.entries} entries, and ${counts.jobs} saved jobs. Skipped ${counts.skippedEntries + counts.skippedJobs} duplicates.`,
    complete: true,
    draftHash: row.draft_hash,
    normalizedUpdatedAt: draft.updatedAt,
    counts,
  };
}
