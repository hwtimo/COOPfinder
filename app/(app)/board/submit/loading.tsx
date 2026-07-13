import { Skeleton } from "@/components/ui/skeleton";

export default function BoardSubmitLoading() {
  return (
    <div className="space-y-5" aria-label="Loading board submission form">
      <Skeleton className="h-5 w-36 rounded" />
      <div>
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl rounded" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-[720px] rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
