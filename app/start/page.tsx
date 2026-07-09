import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSupabaseUser } from "@/lib/supabase/user";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const user = await getSupabaseUser();

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[720px] flex-col justify-center">
        <Link
          href={user ? "/dashboard" : "/start"}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-brand text-[13px] text-white">
            C
          </span>
          COOPfinder
        </Link>

        <section className="rounded-md border bg-card p-6 shadow-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Onboarding preview
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Start your co-op profile
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Guided onboarding is coming next. For now, you can browse the
            starter jobs preview or log in to open the existing mock workspace.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" className="h-10" asChild>
              <Link href="/jobs">Browse jobs</Link>
            </Button>
            {user ? (
              <Button variant="outline" size="lg" className="h-10" asChild>
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <Button variant="outline" size="lg" className="h-10" asChild>
                <Link href="/login?next=/dashboard">Log in</Link>
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
