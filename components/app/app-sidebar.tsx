"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Briefcase,
  KanbanSquare,
  FileText,
  Calendar,
  BarChart3,
  Folder,
  Settings,
  GraduationCap,
  Star,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { currentUser } from "@/lib/mock";

const mainNav = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Applications", href: "/applications", icon: KanbanSquare },
  { label: "Resumes", href: "/resumes", icon: FileText },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Insights", href: "/insights", icon: BarChart3 },
  { label: "Documents", href: "/documents", icon: Folder },
];

const savedViews = [
  { label: "Fall 2026 term", href: "/jobs", icon: GraduationCap },
  { label: "Favorite companies", href: "/jobs", icon: Star },
  { label: "Resume versions", href: "/resumes", icon: Layers },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-[13px] font-semibold text-sidebar-primary-foreground">
          C
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">
          COOPfinder
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        <ul className="space-y-0.5">
          {mainNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Saved views */}
        <div className="mt-6">
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted/80">
            Saved views
          </p>
          <ul className="space-y-0.5">
            {savedViews.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Bottom: settings + user */}
      <div className="border-t border-sidebar-border px-2 py-3">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            pathname.startsWith("/settings")
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <Settings className="size-4 shrink-0" aria-hidden />
          Settings
        </Link>
        <div className="mt-2 flex items-center gap-2.5 rounded-md px-2.5 py-1.5">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-medium text-sidebar-foreground">
            {currentUser.initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] text-sidebar-foreground">
              {currentUser.name}
            </p>
            <p className="truncate text-[11px] text-sidebar-muted">
              {currentUser.school} · {currentUser.program}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
