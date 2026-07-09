import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-44" />
        </div>
        <div className="border-b p-4">
          <Skeleton className="h-9 w-full max-w-xl rounded-md" />
          <div className="mt-4 flex flex-wrap gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-36 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="p-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-10 items-center gap-4 border-b py-3 last:border-0"
            >
              <Skeleton className="col-span-2 h-4 w-full" />
              <Skeleton className="col-span-2 h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
