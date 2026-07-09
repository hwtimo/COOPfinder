import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/mock";

/* DESIGN.md §9.5 status colors — dot + tinted pill, never color alone */
const statusConfig: Record<
  ApplicationStatus,
  { label: string; className: string; dotClassName: string }
> = {
  saved: {
    label: "Saved",
    className: "bg-muted text-text-secondary",
    dotClassName: "bg-muted-foreground",
  },
  tailoring: {
    label: "Tailoring",
    className: "bg-info-soft text-info",
    dotClassName: "bg-info",
  },
  ready: {
    label: "Ready to apply",
    className: "bg-brand-soft text-brand",
    dotClassName: "bg-brand",
  },
  applied: {
    label: "Applied",
    className: "bg-muted text-text-secondary",
    dotClassName: "bg-text-secondary",
  },
  oa: {
    label: "Online assessment",
    className: "bg-info-soft text-info",
    dotClassName: "bg-info",
  },
  interview: {
    label: "Interview",
    className: "bg-success-soft text-success",
    dotClassName: "bg-success",
  },
  offer: {
    label: "Offer",
    className: "bg-success-soft text-success",
    dotClassName: "bg-success",
  },
  rejected: {
    label: "Rejected",
    className: "bg-destructive-soft text-destructive",
    dotClassName: "bg-destructive",
  },
};

interface StatusBadgeProps {
  status: ApplicationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", config.dotClassName)}
        aria-hidden
      />
      {config.label}
    </span>
  );
}

/* Deadline urgency badge — DESIGN.md §5.3: orange upcoming, red overdue */
interface DeadlineBadgeProps {
  daysLeft: number;
  label: string;
  className?: string;
}

export function DeadlineBadge({
  daysLeft,
  label,
  className,
}: DeadlineBadgeProps) {
  /* DESIGN.md §5.3 — red only for overdue, orange for upcoming */
  const tone =
    daysLeft < 0
      ? "bg-destructive-soft text-destructive"
      : daysLeft <= 2
        ? "bg-warning-soft text-warning"
        : "bg-muted text-text-secondary";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
