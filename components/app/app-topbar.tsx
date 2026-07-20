"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogIn, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentUser } from "@/lib/mock";
import { getLoginHref } from "@/lib/auth/paths";

type ShellUser = {
  name: string;
  email: string;
  initials: string;
  meta: string;
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/board": "Job board",
  "/jobs": "My jobs",
  "/applications": "Applications",
  "/resumes": "Resumes",
  "/calendar": "Calendar",
  "/insights": "Insights",
  "/documents": "Documents",
  "/settings": "Settings",
};

export function AppTopbar({ user }: { user: ShellUser | null }) {
  const pathname = usePathname();
  const isAuthenticated = Boolean(user);
  const title =
    Object.entries(pageTitles).find(([href]) =>
      pathname.startsWith(href),
    )?.[1] ?? "COOPfinder";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4 sm:px-5 lg:gap-4 lg:px-6 print:hidden">
      {/* Breadcrumb: workspace context / current page (DESIGN.md §4.3) */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5 text-sm"
      >
        <span className="hidden truncate text-muted-foreground sm:inline">
          {currentUser.term}
        </span>
        <span className="hidden text-border-strong sm:inline" aria-hidden>
          /
        </span>
        <span className="truncate font-medium text-foreground">{title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Global search entry point */}
        <Link
          href={isAuthenticated ? "/jobs" : "/board"}
          aria-label={
            isAuthenticated
              ? "Search saved jobs and companies"
              : "Browse the public job board"
          }
          className="hidden h-9 w-64 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="flex-1 text-left">
            {isAuthenticated ? "Search My jobs…" : "Browse job board…"}
          </span>
          <kbd className="rounded border bg-card px-1 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </Link>

        {/* Quick add — DESIGN.md §8.2: primary buttons 36-40px */}
        <Button size="sm" className="h-9 gap-1.5" asChild>
          <Link
            href={
              isAuthenticated
                ? "/jobs"
                : getLoginHref("/jobs", "add_job")
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add job
          </Link>
        </Button>

        {isAuthenticated ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground"
              aria-label="Notifications"
              disabled
              title="Notifications are not available in this mock build"
            >
              <Bell className="size-4" aria-hidden />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Account: ${user?.name ?? currentUser.name}`}
                  className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {user?.initials ?? currentUser.initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground">
                    {user?.name ?? currentUser.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.meta ?? `${currentUser.school} · ${currentUser.program}`}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action="/auth/sign-out" method="post">
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-left">
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="h-9 gap-1.5" asChild>
              <Link href={getLoginHref(pathname)}>
                <LogIn className="size-3.5" aria-hidden />
                Log in
              </Link>
            </Button>
            <Button size="sm" className="h-9" asChild>
              <Link href="/start">Get started</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
