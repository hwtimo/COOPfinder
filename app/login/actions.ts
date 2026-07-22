"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { reportAuthFailure } from "@/lib/auth/auth-diagnostics";
import { isGoogleAuthEnabled } from "@/lib/auth/config";
import {
  buildAuthCallbackUrl,
  sanitizeLoginReason,
  sanitizeNextPath,
} from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getRequestOrigin(): Promise<string> {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function redirectToLogin(
  next: string,
  reason: string | undefined,
  params: Record<string, string>,
): never {
  const searchParams = new URLSearchParams({ next });
  const safeReason = sanitizeLoginReason(reason);
  if (safeReason) searchParams.set("reason", safeReason);
  Object.entries(params).forEach(([key, value]) => searchParams.set(key, value));
  redirect(`/login?${searchParams.toString()}`);
}

function readAuthFields(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: sanitizeNextPath(formData.get("next")),
    reason: sanitizeLoginReason(formData.get("reason")),
  };
}

export async function signInWithPassword(formData: FormData) {
  const { email, password, next, reason } = readAuthFields(formData);
  if (!email) redirectToLogin(next, reason, { error: "email_required" });
  if (!password) redirectToLogin(next, reason, { error: "password_required" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirectToLogin(next, reason, { error: "supabase_not_configured" });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    reportAuthFailure("password_sign_in", error);
    redirectToLogin(next, reason, { error: "invalid_credentials" });
  }
  redirect(next);
}

export async function signUpWithPassword(formData: FormData) {
  const { email, password, next, reason } = readAuthFields(formData);
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const signupParams = { mode: "signup" };

  if (!email) {
    redirectToLogin(next, reason, { ...signupParams, error: "email_required" });
  }
  if (password.length < 8 || password.length > 128) {
    redirectToLogin(next, reason, {
      ...signupParams,
      error: "password_requirements",
    });
  }
  if (password !== passwordConfirmation) {
    redirectToLogin(next, reason, {
      ...signupParams,
      error: "password_mismatch",
    });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirectToLogin(next, reason, {
      ...signupParams,
      error: "supabase_not_configured",
    });
  }

  const origin = await getRequestOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(origin, next, reason);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) {
    reportAuthFailure("password_sign_up", error);
    redirectToLogin(next, reason, { ...signupParams, error: "sign_up_failed" });
  }
  if (data.session) redirect(next);
  redirectToLogin(next, reason, { signup_sent: "1" });
}

export async function signInWithEmail(formData: FormData) {
  const { email, next, reason } = readAuthFields(formData);
  if (!email) redirectToLogin(next, reason, { error: "email_required" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirectToLogin(next, reason, { error: "supabase_not_configured" });
  }

  const origin = await getRequestOrigin();
  const emailRedirectTo = buildAuthCallbackUrl(origin, next, reason);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo, shouldCreateUser: true },
  });
  if (error) {
    reportAuthFailure("email_sign_in", error);
    redirectToLogin(next, reason, { error: "email_sign_in_failed" });
  }
  redirectToLogin(next, reason, { sent: "1" });
}

export async function signInWithGoogle(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const reason = sanitizeLoginReason(formData.get("reason"));
  if (!isGoogleAuthEnabled()) {
    redirectToLogin(next, reason, { error: "google_sign_in_failed" });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    redirectToLogin(next, reason, { error: "supabase_not_configured" });
  }

  const origin = await getRequestOrigin();
  const redirectTo = buildAuthCallbackUrl(origin, next, reason);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error || !data.url) {
    if (error) reportAuthFailure("google_sign_in", error);
    redirectToLogin(next, reason, { error: "google_sign_in_failed" });
  }
  redirect(data.url);
}
