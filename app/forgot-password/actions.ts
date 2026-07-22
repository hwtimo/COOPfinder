"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { reportAuthFailure } from "@/lib/auth/auth-diagnostics";
import { buildPasswordResetCallbackUrl, sanitizeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requestOrigin() {
  const values = await headers();
  const origin = values.get("origin");
  if (origin) return origin;
  const host = values.get("x-forwarded-host") ?? values.get("host");
  const protocol = values.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = sanitizeNextPath(formData.get("next"));
  const query = new URLSearchParams({ next });
  if (!email) {
    query.set("error", "email_required");
    redirect(`/forgot-password?${query.toString()}`);
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    query.set("error", "supabase_not_configured");
    redirect(`/forgot-password?${query.toString()}`);
  }
  const redirectTo = buildPasswordResetCallbackUrl(await requestOrigin(), next);
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) reportAuthFailure("password_reset_request", error);
  query.set("sent", "1");
  redirect(`/forgot-password?${query.toString()}`);
}
