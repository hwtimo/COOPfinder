import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInOption } from "@/components/auth/google-sign-in-option";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isGoogleAuthEnabled } from "@/lib/auth/config";
import {
  getFirstSearchParam,
  getLoginReasonCopy,
  sanitizeLoginReason,
  sanitizeNextPath,
} from "@/lib/auth/paths";
import { getSupabaseUser } from "@/lib/supabase/user";

import {
  signInWithEmail,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const errorCopy: Record<string, string> = {
  email_required: "Enter your email to continue.",
  email_sign_in_failed: "We could not send the sign-in link. Try again.",
  password_required: "Enter your password to continue.",
  password_requirements: "Use a password between 8 and 128 characters.",
  password_mismatch: "The passwords do not match.",
  invalid_credentials: "The email or password is incorrect.",
  sign_up_failed: "We could not create the account. Check your details and try again.",
  auth_callback_failed: "The sign-in link could not be completed. Request a new link.",
  missing_auth_code: "The sign-in link is incomplete. Request a new link.",
  canonical_auth_required: "Start sign-in again on internshipbc.dev.",
  google_sign_in_failed: "Google sign-in is not available for this Supabase project yet.",
  supabase_not_configured: "Supabase environment variables are not configured for this build.",
};

function authQuery(next: string, reason: string | undefined, mode?: string) {
  return new URLSearchParams({
    next,
    ...(reason ? { reason } : {}),
    ...(mode ? { mode } : {}),
  }).toString();
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = sanitizeNextPath(getFirstSearchParam(params.next));
  const reason = sanitizeLoginReason(getFirstSearchParam(params.reason));
  const sent = getFirstSearchParam(params.sent) === "1";
  const signupSent = getFirstSearchParam(params.signup_sent) === "1";
  const passwordUpdated = getFirstSearchParam(params.password_updated) === "1";
  const signupMode = getFirstSearchParam(params.mode) === "signup";
  const error = getFirstSearchParam(params.error);
  const user = await getSupabaseUser();
  const googleAuthEnabled = isGoogleAuthEnabled();

  if (user) redirect(next);

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[420px] flex-col justify-center">
        <Link href="/start" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <span className="flex size-7 items-center justify-center rounded-md bg-brand text-[13px] text-white">C</span>
          COOPfinder
        </Link>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">Save your progress</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {signupMode ? "Create your COOPfinder account" : "Log in to COOPfinder"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{getLoginReasonCopy(reason)}</p>

          {sent ? <div className="mt-4 rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm">Check your email for a secure sign-in link. You can keep this tab open.</div> : null}
          {signupSent ? <div className="mt-4 rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm">Check your email to confirm your account, then return here to log in.</div> : null}
          {passwordUpdated ? <div className="mt-4 rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm">Your password was updated. Log in with the new password.</div> : null}
          {error ? <div className="mt-4 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-sm">{errorCopy[error] ?? "Sign-in could not start. Try again."}</div> : null}

          {googleAuthEnabled ? (
            <>
              <form action={signInWithGoogle} className="mt-5">
                <input type="hidden" name="next" value={next} />
                <input type="hidden" name="reason" value={reason ?? ""} />
                <GoogleSignInOption enabled />
              </form>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>OR CONTINUE WITH EMAIL</span><span className="h-px flex-1 bg-border" /></div>
            </>
          ) : null}

          <form action={signupMode ? signUpWithPassword : signInWithPassword} className={`${googleAuthEnabled ? "" : "mt-5"} space-y-3`}>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="reason" value={reason ?? ""} />
            <label className="block text-xs font-medium">Email<Input name="email" type="email" required autoComplete="email" className="mt-1.5 h-10 bg-background text-sm" /></label>
            <label className="block text-xs font-medium">Password<Input name="password" type="password" required minLength={signupMode ? 8 : undefined} maxLength={128} autoComplete={signupMode ? "new-password" : "current-password"} className="mt-1.5 h-10 bg-background text-sm" /></label>
            {signupMode ? <label className="block text-xs font-medium">Confirm password<Input name="passwordConfirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-1.5 h-10 bg-background text-sm" /></label> : null}
            <Button type="submit" size="lg" className="h-10 w-full">{signupMode ? "Create account" : "Log in"}</Button>
          </form>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <Link href={`/login?${authQuery(next, reason, signupMode ? undefined : "signup")}`} className="text-brand hover:underline">{signupMode ? "Already have an account?" : "Create an account"}</Link>
            {!signupMode ? <Link href={`/forgot-password?${new URLSearchParams({ next }).toString()}`} className="text-brand hover:underline">Forgot password?</Link> : null}
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>OR USE A SIGN-IN LINK</span><span className="h-px flex-1 bg-border" /></div>
          <form action={signInWithEmail} className="space-y-3">
            <input type="hidden" name="next" value={next} /><input type="hidden" name="reason" value={reason ?? ""} />
            <label className="block text-xs font-medium">Email<Input name="email" type="email" required autoComplete="email" className="mt-1.5 h-10 bg-background text-sm" /></label>
            <Button type="submit" variant="outline" size="lg" className="h-10 w-full">Email me a sign-in link</Button>
          </form>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">New accounts include 1 free tailoring credit. Application tracking is free.</p>
        </section>
      </div>
    </main>
  );
}
