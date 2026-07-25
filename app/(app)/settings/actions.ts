"use server";

import { redirect } from "next/navigation";

import {
  deleteCurrentAccount,
  type DeleteCurrentAccountResult,
} from "@/lib/account/delete-current-account";
import { removeOwnedStorageObjects } from "@/lib/account/remove-owned-storage-objects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteAccountActionState = Readonly<{
  status: "idle" | Exclude<DeleteCurrentAccountResult["status"], "deleted">;
  message: string;
}>;

export const INITIAL_DELETE_ACCOUNT_STATE: DeleteAccountActionState = {
  status: "idle",
  message: "",
};

const MESSAGES: Record<
  Exclude<DeleteCurrentAccountResult["status"], "deleted">,
  string
> = {
  invalid_confirmation: "Type DELETE exactly to confirm account deletion.",
  unauthenticated: "Your session has expired. Sign in again before continuing.",
  storage_unavailable:
    "Your account could not be deleted because stored files could not be removed.",
  account_unavailable:
    "Your account could not be deleted. Nothing else was changed.",
  session_unavailable:
    "Your account was deleted, but sign-out could not finish. Close this browser before continuing.",
};

export async function deleteAccountAction(
  _previousState: DeleteAccountActionState,
  formData: FormData,
): Promise<DeleteAccountActionState> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return { status: "account_unavailable", message: MESSAGES.account_unavailable };
  }

  const result = await deleteCurrentAccount(formData.get("confirmation"), {
    getAuthenticatedUser: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      return error || !user ? null : { id: user.id };
    },
    removeOwnedStorageObjects,
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      return !error;
    },
    clearSession: async () => {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      return !error;
    },
  });

  if (result.status === "deleted") redirect("/start?account_deleted=1");
  return { status: result.status, message: MESSAGES[result.status] };
}
