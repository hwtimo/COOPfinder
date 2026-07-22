import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFirstSearchParam, sanitizeNextPath } from "@/lib/auth/paths";
import { updatePassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = sanitizeNextPath(getFirstSearchParam(params.next));
  const error = getFirstSearchParam(params.error);
  const errorText = error === "password_requirements" ? "Use a password between 8 and 128 characters." : error === "password_mismatch" ? "The passwords do not match." : error ? "This reset session is unavailable or expired. Request a new link." : null;
  return <main className="min-h-dvh bg-background px-4 py-8 text-foreground"><section className="mx-auto mt-20 w-full max-w-[420px] rounded-md border bg-card p-5 shadow-sm"><h1 className="text-xl font-semibold">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Set a new password for your COOPfinder account.</p>{errorText ? <div className="mt-4 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-sm">{errorText}</div> : null}<form action={updatePassword} className="mt-5 space-y-3"><input type="hidden" name="next" value={next} /><label className="block text-xs font-medium">New password<Input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-1.5 h-10" /></label><label className="block text-xs font-medium">Confirm new password<Input name="passwordConfirmation" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className="mt-1.5 h-10" /></label><Button type="submit" className="w-full">Update password</Button></form><Link href={`/forgot-password?${new URLSearchParams({ next }).toString()}`} className="mt-4 inline-block text-sm text-brand hover:underline">Request a new reset link</Link></section></main>;
}
