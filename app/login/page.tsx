import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getFirstSearchParam,
  getLoginReasonCopy,
  sanitizeNextPath,
} from "@/lib/auth/paths";
import { getSupabaseUser } from "@/lib/supabase/user";

import { signInWithEmail, signInWithGoogle } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    reason?: string | string[];
    sent?: string | string[];
    error?: string | string[];
  }>;
};

const errorCopy: Record<string, string> = {
  email_required: "Enter your email to continue.",
  email_sign_in_failed: "We could not send the sign-in link. Try again.",
  google_sign_in_failed:
    "Google sign-in is not available for this Supabase project yet.",
  supabase_not_configured:
    "Supabase environment variables are not configured for this local build yet.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = sanitizeNextPath(getFirstSearchParam(params.next));
  const reason = getFirstSearchParam(params.reason);
  const sent = getFirstSearchParam(params.sent) === "1";
  const error = getFirstSearchParam(params.error);
  const user = await getSupabaseUser();

  if (user) {
    redirect(next);
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[420px] flex-col justify-center">
        <Link
          href="/start"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-brand text-[13px] text-white">
            C
          </span>
          COOPfinder
        </Link>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Save your progress
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              Log in to COOPfinder
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {getLoginReasonCopy(reason)}
            </p>
          </div>

          {sent ? (
            <div className="mt-4 rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm text-foreground">
              Check your email for a secure sign-in link. You can keep this tab
              open.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-sm text-foreground">
              {errorCopy[error] ?? "Sign-in could not start. Try again."}
            </div>
          ) : null}

          <form action={signInWithEmail} className="mt-5 space-y-3">
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="reason" value={reason ?? ""} />
            <label className="block text-xs font-medium text-foreground">
              Email
              <Input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="maya@sfu.ca"
                className="mt-1.5 h-10 bg-background text-sm"
              />
            </label>
            <Button type="submit" size="lg" className="h-10 w-full">
              Send sign-in link
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="reason" value={reason ?? ""} />
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="h-10 w-full"
            >
              Continue with Google
            </Button>
          </form>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            New accounts include 2 free tailoring credits. Application tracking
            is free.
          </p>
        </section>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/start" className="text-muted-foreground hover:text-foreground">
            Start your profile
          </Link>
          <Link href="/jobs" className="text-brand hover:underline">
            Browse jobs
          </Link>
        </div>
      </div>
    </main>
  );
}
