import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFirstSearchParam, sanitizeNextPath } from "@/lib/auth/paths";
import { requestPasswordReset } from "./actions";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = sanitizeNextPath(getFirstSearchParam(params.next));
  const sent = getFirstSearchParam(params.sent) === "1";
  const error = getFirstSearchParam(params.error);
  return <main className="min-h-dvh bg-background px-4 py-8 text-foreground"><section className="mx-auto mt-20 w-full max-w-[420px] rounded-md border bg-card p-5 shadow-sm"><h1 className="text-xl font-semibold">Reset your password</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Enter your email and we’ll send a secure reset link.</p>{sent ? <div className="mt-4 rounded-md border border-success/20 bg-success-soft px-3 py-2 text-sm">If an account exists for that email, a reset link is on its way.</div> : null}{error ? <div className="mt-4 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-sm">{error === "email_required" ? "Enter your email to continue." : "Password reset is temporarily unavailable."}</div> : null}<form action={requestPasswordReset} className="mt-5 space-y-3"><input type="hidden" name="next" value={next} /><label className="block text-xs font-medium">Email<Input name="email" type="email" required autoComplete="email" className="mt-1.5 h-10" /></label><Button type="submit" className="w-full">Send reset link</Button></form><Link href={`/login?${new URLSearchParams({ next }).toString()}`} className="mt-4 inline-block text-sm text-brand hover:underline">Back to login</Link></section></main>;
}
