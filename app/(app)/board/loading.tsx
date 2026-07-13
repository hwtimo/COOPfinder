import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="space-y-5" aria-label="Loading job board">
      <div>
        <Skeleton className="h-6 w-36 rounded" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl rounded" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg border bg-card p-5">
          <Skeleton className="h-5 w-64 rounded" />
          <Skeleton className="mt-2 h-4 w-32 rounded" />
          <Skeleton className="mt-5 h-20 w-full rounded-md" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
