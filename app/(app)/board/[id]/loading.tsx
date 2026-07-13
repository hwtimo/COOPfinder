import { Skeleton } from "@/components/ui/skeleton";

export default function BoardDetailLoading() {
  return (
    <div className="space-y-5" aria-label="Loading reviewed role">
      <Skeleton className="h-4 w-32 rounded" />
      <div>
        <Skeleton className="h-6 w-72 max-w-full rounded" />
        <Skeleton className="mt-2 h-4 w-48 rounded" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Skeleton className="h-52 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
