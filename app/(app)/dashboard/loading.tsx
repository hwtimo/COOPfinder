import { Skeleton } from "@/components/ui/skeleton";

/* DESIGN.md §11 — skeletons for dashboard cards, no generic spinner */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-3 h-3 w-24" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <div className="rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
            <div className="space-y-0 p-5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="grid gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0 md:grid-cols-[150px_minmax(0,1fr)_150px] md:items-center"
                >
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-3 w-24 md:justify-self-end" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
            <div className="p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-7 items-center gap-4 border-b py-3 last:border-0"
                >
                  <Skeleton className="col-span-2 h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          {Array.from({ length: 3 }).map((_, cardIndex) => (
            <div key={cardIndex} className="rounded-lg border bg-card">
              <div className="border-b px-5 py-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-3 w-44" />
              </div>
              <div className="space-y-4 p-5">
                {Array.from({ length: cardIndex === 2 ? 3 : 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
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
