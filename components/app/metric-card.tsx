import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "warning";
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

/* DESIGN.md §9.1 — Asana-like metric card: large but not bold number */
export function MetricCard({
  label,
  value,
  helper,
  tone = "default",
  actionLabel,
  actionHref,
  className,
}: MetricCardProps) {
  const actionClassName =
    "mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-[32px] font-medium leading-none tabular-nums tracking-tight",
          tone === "warning" ? "text-warning" : "text-foreground",
        )}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
      ) : null}
      {actionLabel ? (
        actionHref ? (
          <Link href={actionHref} className={actionClassName}>
            {actionLabel}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        ) : (
          <span className={actionClassName}>
            {actionLabel}
            <ArrowRight className="size-3" aria-hidden />
          </span>
        )
      ) : null}
    </div>
  );
}
