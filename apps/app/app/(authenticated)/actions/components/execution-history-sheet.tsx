"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@repo/design-system/components/ui/sheet";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  Loader2Icon,
  AlertCircleIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setTaskExecutions,
  setLoadingExecutions,
  type ScheduledTaskExecution,
} from "@/lib/store/slices/scheduledTasks.slice";
import { normalizeScheduledTaskExecution } from "@/lib/store/hooks/useScheduledTasksData";
import { getTrpcClient } from "@/lib/trpc/vanilla";

const executionStatusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: { label: "Pending", variant: "outline", icon: ClockIcon },
  running: { label: "Running", variant: "default", icon: Loader2Icon },
  success: { label: "Success", variant: "secondary", icon: CheckCircle2Icon },
  failed: { label: "Failed", variant: "destructive", icon: XCircleIcon },
  cancelled: { label: "Cancelled", variant: "secondary", icon: XCircleIcon },
};

interface ExecutionHistorySheetProps {
  taskId: string | null;
  taskName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionHistorySheet({
  taskId,
  taskName,
  open,
  onOpenChange,
}: ExecutionHistorySheetProps) {
  const dispatch = useAppDispatch();
  const executionsMap = useAppSelector((state) => state.scheduledTasks.executions);
  const executions = useMemo(
    () => (taskId ? executionsMap[taskId] ?? [] : []),
    [executionsMap, taskId]
  );
  const isLoading = useAppSelector((state) => state.scheduledTasks.isLoadingExecutions);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;

    let cancelled = false;
    dispatch(setLoadingExecutions(true));
    setFetchError(null);

    getTrpcClient()
      .scheduledTasks.getExecutions.query({ taskId })
      .then((data) => {
        if (!cancelled) {
          const normalized = data.map(normalizeScheduledTaskExecution);
          dispatch(setTaskExecutions({ taskId, executions: normalized }));
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setFetchError(err.message || "Failed to load executions");
          dispatch(setLoadingExecutions(false));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, taskId, dispatch]);

  function formatDuration(ms: number | null) {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Execution History</SheetTitle>
          <SheetDescription>{taskName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}

          {!isLoading && fetchError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircleIcon className="h-4 w-4 shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}

          {!isLoading && !fetchError && executions.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No executions yet. Run the automation to see history here.
            </div>
          )}

          {!isLoading &&
            !fetchError &&
            executions.map((exec: ScheduledTaskExecution) => {
              const statusCfg = executionStatusConfig[exec.status] ?? executionStatusConfig.pending!;
              const StatusIcon = statusCfg.icon;

              return (
                <div key={exec.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={statusCfg.variant} className="gap-1 text-xs">
                      <StatusIcon
                        className={`h-3 w-3 ${exec.status === "running" ? "animate-spin" : ""}`}
                      />
                      {statusCfg.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {exec.createdAt
                        ? formatDistanceToNow(new Date(exec.createdAt), { addSuffix: true })
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {exec.startedAt && (
                      <span>Started: {format(new Date(exec.startedAt), "MMM d, h:mm:ss a")}</span>
                    )}
                    {exec.completedAt && (
                      <span>
                        Completed: {format(new Date(exec.completedAt), "MMM d, h:mm:ss a")}
                      </span>
                    )}
                    <span>Duration: {formatDuration(exec.durationMs ?? null)}</span>
                  </div>
                  {exec.error && (
                    <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                      {exec.error}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
