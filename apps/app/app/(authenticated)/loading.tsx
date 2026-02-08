import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export default function AuthenticatedLoading() {
  return (
    <div className="flex h-full w-full flex-col gap-4 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg" />
      </div>
    </div>
  );
}
