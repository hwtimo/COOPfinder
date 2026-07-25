import Link from "next/link";

import { cn } from "@/lib/utils";

export function PublicLegalLinks({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <nav
      aria-label="Legal"
      className={cn(
        "flex items-center justify-center gap-4 text-xs text-muted-foreground",
        className,
      )}
    >
      <Link href="/privacy" className="hover:text-foreground hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground hover:underline">
        Terms
      </Link>
    </nav>
  );
}
