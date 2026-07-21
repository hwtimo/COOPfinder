import { NextResponse, type NextRequest } from "next/server";

import { reportAuthFailure } from "@/lib/auth/auth-diagnostics";
import { sanitizeNextPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);

  if (!code) {
    loginUrl.searchParams.set("error", "missing_auth_code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    loginUrl.searchParams.set("error", "supabase_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    reportAuthFailure("auth_callback", error);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
