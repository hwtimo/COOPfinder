import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onActionHref?: string;
  className?: string;
}

/* DESIGN.md §10 — explain what belongs here + one primary action */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onActionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-4 py-12 text-center sm:px-6 sm:py-16",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {actionLabel ? (
        onActionHref ? (
          <Button asChild size="sm" className="mt-5 h-9">
            <Link href={onActionHref}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            className="mt-5 h-9"
            disabled
            title="This action is not available in the mock build"
          >
            {actionLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
