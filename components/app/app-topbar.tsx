"use client";

import { usePathname } from "next/navigation";
import { Bell, Plus, Search } from "lucide-react";
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

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/jobs": "Jobs",
  "/applications": "Applications",
  "/resumes": "Resumes",
  "/calendar": "Calendar",
  "/insights": "Insights",
  "/documents": "Documents",
  "/settings": "Settings",
};

export function AppTopbar() {
  const pathname = usePathname();
  const title =
    Object.entries(pageTitles).find(([href]) =>
      pathname.startsWith(href),
    )?.[1] ?? "COOPfinder";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-card px-6">
      {/* Breadcrumb: workspace context / current page (DESIGN.md §4.3) */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">{currentUser.term}</span>
        <span className="text-border-strong" aria-hidden>
          /
        </span>
        <span className="font-medium text-foreground">{title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {/* Global search (mock) */}
        <button
          type="button"
          aria-label="Search jobs and companies"
          className="hidden h-9 w-64 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
        >
          <Search className="size-3.5" aria-hidden />
          <span className="flex-1 text-left">Search jobs, companies…</span>
          <kbd className="rounded border bg-card px-1 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        {/* Quick add — DESIGN.md §8.2: primary buttons 36-40px */}
        <Button size="sm" className="h-9 gap-1.5">
          <Plus className="size-3.5" aria-hidden />
          Add job
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account: ${currentUser.name}`}
              className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {currentUser.initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-foreground">
                {currentUser.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentUser.school} · {currentUser.program}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings">Profile</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/settings">Settings</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
