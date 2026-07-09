import { Skeleton } from "@/components/ui/skeleton";

export default function JobDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-28" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-80" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="h-5 w-36 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-5 w-48" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-md border bg-background p-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          {Array.from({ length: 5 }).map((_, cardIndex) => (
            <div key={cardIndex} className="rounded-lg border bg-card">
              <div className="border-b px-5 py-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-3 w-48" />
              </div>
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((__, rowIndex) => (
                  <Skeleton key={rowIndex} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, cardIndex) => (
            <div key={cardIndex} className="rounded-lg border bg-card">
              <div className="border-b px-5 py-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
              <div className="space-y-4 p-5">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-5 w-full rounded-full" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
