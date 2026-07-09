import type { LucideIcon } from "lucide-react";
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
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-card px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {actionLabel ? (
        onActionHref ? (
          <Button asChild size="sm" className="mt-5 h-9">
            <a href={onActionHref}>{actionLabel}</a>
          </Button>
        ) : (
          <Button size="sm" className="mt-5 h-9">
            {actionLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
