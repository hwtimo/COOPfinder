import { NextResponse, type NextRequest } from "next/server";

import { getLoginHref } from "@/lib/auth/paths";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const isPrivateJobsPath =
    request.nextUrl.pathname === "/jobs" ||
    request.nextUrl.pathname.startsWith("/jobs/");
  const isMasterProfilePath = request.nextUrl.pathname === "/resumes/master";

  // Let the Jobs pages render their explicit configuration-disabled state in
  // local builds where auth cannot be evaluated at all.
  if ((isPrivateJobsPath || isMasterProfilePath) && !getSupabaseEnv()) {
    return response;
  }

  if (user) return response;

  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (isPrivateJobsPath) {
    const boardUrl = new URL("/board", request.url);
    const redirectResponse = NextResponse.redirect(boardUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  const loginUrl = new URL(getLoginHref(next), request.url);
  const redirectResponse = NextResponse.redirect(loginUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export const config = {
  matcher: [
    "/jobs/:path*",
    "/dashboard/:path*",
    "/applications/:path*",
    "/resumes/:path*",
    "/calendar/:path*",
    "/insights/:path*",
    "/documents/:path*",
    "/settings/:path*",
  ],
};
