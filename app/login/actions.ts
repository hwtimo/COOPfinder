"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/paths";
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

  if (reason) searchParams.set("reason", reason);

  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, value);
  });

  redirect(`/login?${searchParams.toString()}`);
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = sanitizeNextPath(formData.get("next"));
  const reason = String(formData.get("reason") ?? "") || undefined;

  if (!email) {
    redirectToLogin(next, reason, { error: "email_required" });
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirectToLogin(next, reason, { error: "supabase_not_configured" });
  }

  const origin = await getRequestOrigin();
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(
    next,
  )}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirectToLogin(next, reason, { error: "email_sign_in_failed" });
  }

  redirectToLogin(next, reason, { sent: "1" });
}

export async function signInWithGoogle(formData: FormData) {
  const next = sanitizeNextPath(formData.get("next"));
  const reason = String(formData.get("reason") ?? "") || undefined;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirectToLogin(next, reason, { error: "supabase_not_configured" });
  }

  const origin = await getRequestOrigin();
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    redirectToLogin(next, reason, { error: "google_sign_in_failed" });
  }

  redirect(data.url);
}
