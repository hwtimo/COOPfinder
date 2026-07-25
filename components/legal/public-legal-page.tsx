import type { ReactNode } from "react";
import Link from "next/link";

type PublicLegalPageProps = Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>;

export function PublicLegalPage({
  title,
  description,
  children,
}: PublicLegalPageProps) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 w-full max-w-[880px] items-center px-4 sm:px-6">
          <Link
            href="/start"
            className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-brand text-[13px] text-white">
              I
            </span>
            InternshipBC
          </Link>
          <nav
            aria-label="Legal and account"
            className="ml-auto flex items-center gap-4 text-xs"
          >
            <Link href="/privacy" className="hover:text-brand">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-brand">
              Terms
            </Link>
            <Link
              href="/login"
              className="font-medium text-brand hover:underline"
            >
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-xs font-medium uppercase text-muted-foreground">
          InternshipBC
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Effective July 25, 2026
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-text-secondary">
          {children}
        </div>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
