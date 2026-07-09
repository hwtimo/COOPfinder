import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-56 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      <div className="rounded-lg border bg-card px-4 py-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-3 w-96" />
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1260px] grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, columnIndex) => (
            <section
              key={columnIndex}
              className="flex min-h-[560px] flex-col rounded-lg border bg-card"
            >
              <div className="border-b px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-7 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
              <div className="space-y-3 p-3">
                {Array.from({ length: columnIndex % 3 === 0 ? 2 : 1 }).map(
                  (_, cardIndex) => (
                    <div
                      key={cardIndex}
                      className="rounded-md border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <div className="mt-3">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="mt-3 h-3 w-28" />
                      <div className="mt-3 flex gap-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </div>
                      <Skeleton className="mt-3 h-8 w-full rounded-md" />
                    </div>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
