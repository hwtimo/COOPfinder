import { cn } from "@/lib/utils";

interface CardSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/* DESIGN.md §8.1 — white card, thin border, clear header, no heavy shadow */
export function CardSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: CardSectionProps) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}
