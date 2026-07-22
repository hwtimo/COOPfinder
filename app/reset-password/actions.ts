"use server";

import { redirect } from "next/navigation";
import { reportAuthFailure } from "@/lib/auth/auth-diagnostics";
import { sanitizeNextPath } from "@/lib/auth/paths";
import { classifyPasswordUpdateFailure } from "@/lib/auth/password-reset";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  const next = sanitizeNextPath(formData.get("next"));
  const query = new URLSearchParams({ next });
  if (password.length < 8 || password.length > 128) {
    query.set("error", "password_requirements");
    redirect(`/reset-password?${query.toString()}`);
  }
  if (password !== confirmation) {
    query.set("error", "password_mismatch");
    redirect(`/reset-password?${query.toString()}`);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    query.set("error", "reset_unavailable");
    redirect(`/reset-password?${query.toString()}`);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    query.set("error", "reset_session_required");
    redirect(`/reset-password?${query.toString()}`);
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    reportAuthFailure("password_update", error);
    query.set("error", classifyPasswordUpdateFailure(error));
    redirect(`/reset-password?${query.toString()}`);
  }
  await supabase.auth.signOut();
  query.set("password_updated", "1");
  redirect(`/login?${query.toString()}`);
}
