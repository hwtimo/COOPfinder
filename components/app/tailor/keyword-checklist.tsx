import { CheckCircle2, CircleAlert, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";

export type KeywordStatus = "covered" | "review" | "missing";

export interface KeywordChecklistItem {
  id: string;
  keyword: string;
  status: KeywordStatus;
  source: string;
}

/* Never color alone — icon + text per DESIGN.md §14 */
const statusConfig: Record<
  KeywordStatus,
  { label: string; iconClassName: string; Icon: typeof CheckCircle2 }
> = {
  covered: {
    label: "Covered",
    iconClassName: "text-success",
    Icon: CheckCircle2,
  },
  review: {
    label: "Review",
    iconClassName: "text-warning",
    Icon: CircleAlert,
  },
  missing: {
    label: "Missing",
    iconClassName: "text-muted-foreground",
    Icon: CircleSlash,
  },
};

interface KeywordChecklistProps {
  items: KeywordChecklistItem[];
  className?: string;
}

export function KeywordChecklist({ items, className }: KeywordChecklistProps) {
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => {
        const config = statusConfig[item.status];
        return (
          <li key={item.id} className="flex items-start gap-2.5">
            <config.Icon
              className={cn("mt-0.5 size-4 shrink-0", config.iconClassName)}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {item.keyword}
                </p>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  {config.label}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.source}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
