import { NextResponse, type NextRequest } from "next/server";

import { getLoginHref } from "@/lib/auth/paths";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);

  if (user) return response;

  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = new URL(getLoginHref(next), request.url);
  const redirectResponse = NextResponse.redirect(loginUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/applications/:path*",
    "/resumes/:path*",
    "/calendar/:path*",
    "/insights/:path*",
    "/documents/:path*",
    "/settings/:path*",
  ],
};
