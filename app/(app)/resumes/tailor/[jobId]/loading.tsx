import { Skeleton } from "@/components/ui/skeleton";

/* DESIGN.md §11 — skeleton for the 3-panel workspace, no generic spinner */
export default function TailorLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <div className="hidden rounded-lg border bg-card p-5 xl:block">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-44" />
          <div className="mt-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-md border p-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-56" />
          <div className="mt-6 space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-md border p-4">
                <div className="flex justify-between gap-3">
                  <Skeleton className="h-5 w-44 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="mt-4 h-3 w-16" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="mt-1 h-4 w-3/4" />
                <Skeleton className="mt-4 h-3 w-16" />
                <Skeleton className="mt-2 h-4 w-full" />
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-5">
              <Skeleton className="h-4 w-36" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
