import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>

      {/* Messages skeleton */}
      <div className="flex-1 space-y-4 overflow-hidden p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* User message skeleton */}
          <div className="flex justify-end">
            <Skeleton className="h-12 w-48 rounded-2xl" />
          </div>

          {/* Assistant message skeleton */}
          <div className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>

          {/* User message skeleton */}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-36 rounded-2xl" />
          </div>

          {/* Assistant message skeleton */}
          <div className="flex gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
