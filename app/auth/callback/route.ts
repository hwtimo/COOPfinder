import { NextResponse, type NextRequest } from "next/server";

import { reportAuthFailure } from "@/lib/auth/auth-diagnostics";
import {
  buildAppUrl,
  resolveAuthOrigin,
  sanitizeLoginReason,
  sanitizeNextPath,
} from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const reason = sanitizeLoginReason(searchParams.get("reason"));
  const canonicalOrigin = resolveAuthOrigin(request.nextUrl.origin);
  const loginUrl = new URL("/login", canonicalOrigin);
  loginUrl.searchParams.set("next", next);
  if (reason) loginUrl.searchParams.set("reason", reason);

  const redirectResponse = (url: URL) => {
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  };

  if (request.nextUrl.origin !== canonicalOrigin) {
    loginUrl.searchParams.set("error", "canonical_auth_required");
    return redirectResponse(loginUrl);
  }

  if (!code) {
    loginUrl.searchParams.set("error", "missing_auth_code");
    return redirectResponse(loginUrl);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    loginUrl.searchParams.set("error", "supabase_not_configured");
    return redirectResponse(loginUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    reportAuthFailure("auth_callback", error);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return redirectResponse(loginUrl);
  }

  return redirectResponse(buildAppUrl(request.nextUrl.origin, next));
}
