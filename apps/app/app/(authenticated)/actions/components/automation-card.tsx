"use client";

import { useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  ZapIcon,
  RepeatIcon,
  ClockIcon,
  CodeIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  PencilIcon,
  HistoryIcon,
  MoreVerticalIcon,
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  PlugIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  deleteScheduledTask as deleteScheduledTaskAction,
  updateScheduledTask,
  type ScheduledTask,
} from "@/lib/store/slices/scheduledTasks.slice";
import { normalizeScheduledTask } from "@/lib/store/hooks/useScheduledTasksData";
import {
  useRunScheduledTaskNowMutation,
  usePauseScheduledTaskMutation,
  useResumeScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
} from "@/lib/store/api/api.slice";

const scheduleTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; variant: "default" | "secondary" | "outline" }
> = {
  trigger: { label: "Trigger", icon: ZapIcon, variant: "default" },
  recurring: { label: "Recurring", icon: RepeatIcon, variant: "secondary" },
  once: { label: "One-time", icon: ClockIcon, variant: "outline" },
  cron: { label: "Cron", icon: CodeIcon, variant: "outline" },
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: "Active", variant: "outline", icon: ClockIcon },
  running: { label: "Running", variant: "default", icon: Loader2Icon },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle2Icon },
  failed: { label: "Failed", variant: "destructive", icon: XCircleIcon },
  cancelled: { label: "Cancelled", variant: "secondary", icon: XCircleIcon },
  paused: { label: "Paused", variant: "outline", icon: PauseIcon },
};

const taskTypeLabels: Record<string, string> = {
  agent_run: "AI Agent",
  report: "Report",
  sync: "Data Sync",
  backup: "Backup",
  custom: "Custom",
};

interface AutomationCardProps {
  task: ScheduledTask;
  onEdit: (task: ScheduledTask) => void;
  onViewHistory: (taskId: string) => void;
  onRefetch: () => void;
}

export function AutomationCard({ task, onEdit, onViewHistory, onRefetch }: AutomationCardProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const [runTaskNow] = useRunScheduledTaskNowMutation();
  const [pauseTask] = usePauseScheduledTaskMutation();
  const [resumeTask] = useResumeScheduledTaskMutation();
  const [deleteTask] = useDeleteScheduledTaskMutation();

  const skillIds = Array.isArray((task.payload as Record<string, unknown> | null)?.skillIds)
    ? ((task.payload as Record<string, unknown>).skillIds as string[])
    : [];
  const connectionIds = Array.isArray((task.payload as Record<string, unknown> | null)?.connectionIds)
    ? ((task.payload as Record<string, unknown>).connectionIds as string[])
    : [];
  const schedType = scheduleTypeConfig[task.scheduleType] ?? scheduleTypeConfig.once!;
  const SchedIcon = schedType.icon;
  const status = statusConfig[task.status] ?? statusConfig.pending!;
  const StatusIcon = status.icon;

  const handleRunNow = async () => {
    try {
      setPendingAction("run");
      await runTaskNow(task.id).unwrap();
      toast.success("Automation triggered");
      onRefetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to run automation");
    } finally {
      setPendingAction(null);
    }
  };

  const handleTogglePause = async () => {
    try {
      const action = task.isEnabled ? "pause" : "resume";
      setPendingAction(action);
      const updated = task.isEnabled
        ? await pauseTask(task.id).unwrap()
        : await resumeTask(task.id).unwrap();
      dispatch(updateScheduledTask({ id: (updated as any)!.id, updates: normalizeScheduledTask(updated!) }));
      toast.success(task.isEnabled ? "Automation paused" : "Automation resumed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update automation");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    try {
      setPendingAction("delete");
      await deleteTask(task.id).unwrap();
      dispatch(deleteScheduledTaskAction(task.id));
      toast.success("Automation deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete automation");
    } finally {
      setPendingAction(null);
    }
  };

  function getScheduleDescription() {
    if (task.scheduleType === "trigger") {
      const app = task.triggerAppName
        ? task.triggerAppName.charAt(0).toUpperCase() + task.triggerAppName.slice(1)
        : "Unknown";
      return `${app} — ${task.triggerEventSlug || "Unknown event"}`;
    }
    if (task.scheduleType === "recurring" && task.recurrencePattern) {
      const pattern = task.recurrencePattern.charAt(0).toUpperCase() + task.recurrencePattern.slice(1);
      return `${pattern}${task.recurrenceTime ? ` at ${task.recurrenceTime}` : ""}`;
    }
    if (task.scheduleType === "once" && task.scheduledAt) {
      return `Scheduled for ${format(new Date(task.scheduledAt), "MMM d, yyyy h:mm a")}`;
    }
    if (task.scheduleType === "cron" && task.cronExpression) {
      return `Cron: ${task.cronExpression}`;
    }
    return "";
  }

  function getLastRunInfo() {
    if (task.scheduleType === "trigger" && task.lastTriggerAt) {
      return `Last triggered ${formatDistanceToNow(new Date(task.lastTriggerAt), { addSuffix: true })}`;
    }
    if (task.lastRunAt) {
      return `Last run ${formatDistanceToNow(new Date(task.lastRunAt), { addSuffix: true })}`;
    }
    return "Never run";
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <SchedIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{task.name}</span>
            <Badge variant={status.variant} className="gap-1 text-xs">
              <StatusIcon className={`h-3 w-3 ${task.status === "running" ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
            <Badge variant={schedType.variant} className="text-xs">
              {schedType.label}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {taskTypeLabels[task.taskType] || task.taskType}
            </Badge>
          </div>
          {skillIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {skillIds.map((id) => (
                <Badge key={id} variant="outline" className="text-xs">
                  {id}
                </Badge>
              ))}
            </div>
          )}
          {connectionIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {connectionIds.map((id) => (
                <Badge key={id} variant="secondary" className="text-xs gap-1">
                  <PlugIcon className="h-2.5 w-2.5" />
                  {id}
                </Badge>
              ))}
            </div>
          )}
          {task.description && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{task.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>{getScheduleDescription()}</span>
            {task.nextRunAt && task.scheduleType !== "trigger" && (
              <>
                <span>·</span>
                <span>Next: {format(new Date(task.nextRunAt), "MMM d, h:mm a")}</span>
              </>
            )}
            <span>·</span>
            <span>{getLastRunInfo()}</span>
            <span>·</span>
            <span>{task.runCount} runs</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-4">
        {/* Run Now */}
        {task.status !== "running" && (
          <Button
            variant="ghost"
            size="sm"
            title="Run now"
            onClick={handleRunNow}
            disabled={pendingAction === "run"}
          >
            {pendingAction === "run" ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <PlayIcon className="h-4 w-4 text-green-600" />
            )}
          </Button>
        )}

        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVerticalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewHistory(task.id)}>
              <HistoryIcon className="h-4 w-4 mr-2" />
              View History
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleTogglePause}
              disabled={pendingAction === "pause" || pendingAction === "resume"}
            >
              {task.isEnabled ? (
                <>
                  <PauseIcon className="h-4 w-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Resume
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete automation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{task.name}&quot; and all its execution history.
                    {task.composioTriggerId && " The associated trigger will also be disabled."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
