import { AlertTriangle, FileCheck2, HelpCircle, Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TailoringTrustLabel } from "@/lib/mock";

/* DESIGN.md §17 — trust labels for AI output. Icon + text, never color alone. */
const trustConfig: Record<
  TailoringTrustLabel,
  { className: string; Icon: typeof FileCheck2 }
> = {
  "Based on your existing resume": {
    className: "bg-success-soft text-success",
    Icon: FileCheck2,
  },
  "Suggested by AI": {
    className: "bg-brand-soft text-brand",
    Icon: Sparkle,
  },
  "Needs confirmation": {
    className: "bg-warning-soft text-warning",
    Icon: HelpCircle,
  },
  "Potential unsupported claim": {
    className: "bg-destructive-soft text-destructive",
    Icon: AlertTriangle,
  },
};

interface TrustBadgeProps {
  label: TailoringTrustLabel;
  className?: string;
}

export function TrustBadge({ label, className }: TrustBadgeProps) {
  const { className: tone, Icon } = trustConfig[label];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
