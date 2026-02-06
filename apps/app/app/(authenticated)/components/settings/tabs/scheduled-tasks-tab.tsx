"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
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
  Loader2Icon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ClockIcon,
  RepeatIcon,
  CheckCircle2Icon,
  XCircleIcon,
  PencilIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ErrorState } from "./error-state";
import Link from "next/link";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  addScheduledTask,
  deleteScheduledTask,
  setScheduledTasksError,
  updateScheduledTask,
  type ScheduledTask,
} from "@/lib/store/slices/scheduledTasks.slice";
import {
  normalizeScheduledTask,
  useScheduledTasksData,
} from "@/lib/store/hooks/useScheduledTasksData";
import { getTrpcClient } from "@/lib/trpc/vanilla";

// Status badge config
const statusConfig: Record<
  string,
  {
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: { variant: "outline", icon: ClockIcon },
  running: { variant: "default", icon: Loader2Icon },
  completed: { variant: "secondary", icon: CheckCircle2Icon },
  failed: { variant: "destructive", icon: XCircleIcon },
  cancelled: { variant: "secondary", icon: XCircleIcon },
  paused: { variant: "outline", icon: PauseIcon },
};

// Task type labels
const taskTypeLabels: Record<string, string> = {
  agent_run: "AI Agent",
  report: "Report",
  sync: "Data Sync",
  backup: "Backup",
  custom: "Custom",
};

// Recurrence pattern labels
const recurrenceLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom",
};

const taskFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]),
  scheduleType: z.enum(["once", "recurring", "cron"]),
  scheduledAt: z.string().optional(),
  recurrencePattern: z
    .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"])
    .optional(),
  recurrenceTime: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export function ScheduledTasksTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<{ id: string; data: TaskFormValues } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: string; id?: string } | null>(null);
  const dispatch = useAppDispatch();

  const { tasks, isLoading, error, refetch } = useScheduledTasksData();

  // Create form
  const createForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: "",
      description: "",
      taskType: "agent_run",
      scheduleType: "recurring",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  // Edit form
  const editForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
  });

  // Reset edit form when editingTask changes
  useEffect(() => {
    if (editingTask) {
      editForm.reset(editingTask.data);
    }
  }, [editingTask, editForm]);

  const createScheduleType = createForm.watch("scheduleType");
  const editScheduleType = editForm.watch("scheduleType");

  const onCreateSubmit = async (data: TaskFormValues) => {
    const submitData = {
      name: data.name,
      description: data.description,
      taskType: data.taskType,
      scheduleType: data.scheduleType,
      timezone: data.timezone,
    };

    if (data.scheduleType === "once" && data.scheduledAt) {
      submitData.scheduledAt = new Date(data.scheduledAt);
    }
    if (data.scheduleType === "recurring") {
      submitData.recurrencePattern = data.recurrencePattern;
      submitData.recurrenceTime = data.recurrenceTime;
    }
    if (data.scheduleType === "cron") {
      submitData.cronExpression = data.cronExpression;
    }

    try {
      setPendingAction({ type: "create" });
      const created = await getTrpcClient().scheduledTasks.create.mutate(submitData);
      dispatch(addScheduledTask(normalizeScheduledTask(created)));
      toast.success("Task scheduled successfully");
      setIsCreateOpen(false);
      createForm.reset();
    } catch (error: any) {
      dispatch(setScheduledTasksError(error?.message || "Failed to create task"));
      toast.error(error?.message || "Failed to create task");
    } finally {
      setPendingAction(null);
    }
  };

  const onEditSubmit = async (data: TaskFormValues) => {
    if (!editingTask) return;

    const submitData = {
      id: editingTask.id,
      name: data.name,
      description: data.description,
      timezone: data.timezone,
    };

    if (data.scheduleType === "recurring") {
      submitData.recurrencePattern = data.recurrencePattern;
      submitData.recurrenceTime = data.recurrenceTime;
    }
    if (data.scheduleType === "cron") {
      submitData.cronExpression = data.cronExpression;
    }

    try {
      setPendingAction({ type: "update", id: editingTask.id });
      const updated = await getTrpcClient().scheduledTasks.update.mutate(submitData);
      dispatch(updateScheduledTask({ id: updated.id, updates: normalizeScheduledTask(updated) }));
      toast.success("Task updated");
      setEditingTask(null);
    } catch (error: any) {
      dispatch(setScheduledTasksError(error?.message || "Failed to update task"));
      toast.error(error?.message || "Failed to update task");
    } finally {
      setPendingAction(null);
    }
  };

  const openEditDialog = (task: ScheduledTask) => {
    setEditingTask({
      id: task.id,
      data: {
        name: task.name,
        description: task.description || "",
        taskType: task.taskType as TaskFormValues["taskType"],
        scheduleType: task.scheduleType as TaskFormValues["scheduleType"],
        scheduledAt: task.scheduledAt
          ? new Date(task.scheduledAt).toISOString().slice(0, 16)
          : undefined,
        recurrencePattern: task.recurrencePattern as TaskFormValues["recurrencePattern"],
        recurrenceTime: task.recurrenceTime || undefined,
        cronExpression: task.cronExpression || undefined,
        timezone: task.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  };

  function renderScheduleFields(
    form: ReturnType<typeof useForm<TaskFormValues>>,
    schedType: string
  ) {
    return (
      <>
        {schedType === "once" && (
          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Run at</Label>
            <Input id="scheduledAt" type="datetime-local" {...form.register("scheduledAt")} />
          </div>
        )}

        {schedType === "recurring" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="recurrencePattern">Frequency</Label>
              <Select
                value={form.watch("recurrencePattern")}
                onValueChange={(value) =>
                  form.setValue("recurrencePattern", value as TaskFormValues["recurrencePattern"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurrenceTime">Time</Label>
              <Input id="recurrenceTime" type="time" {...form.register("recurrenceTime")} />
            </div>
          </>
        )}

        {schedType === "cron" && (
          <div className="space-y-2">
            <Label htmlFor="cronExpression">Cron Expression</Label>
            <Input
              id="cronExpression"
              {...form.register("cronExpression")}
              placeholder="0 9 * * 1-5"
            />
            <p className="text-xs text-muted-foreground">
              Example: &quot;0 9 * * 1-5&quot; runs at 9 AM on weekdays
            </p>
          </div>
        )}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
            <p className="text-sm text-muted-foreground">Automate recurring tasks and workflows.</p>
          </div>
        </div>
        <Separator />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
            <p className="text-sm text-muted-foreground">Automate recurring tasks and workflows.</p>
          </div>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load scheduled tasks"
          message="Unable to load your scheduled tasks. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
          <p className="text-sm text-muted-foreground">Automate recurring tasks and workflows.</p>
        </div>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Scheduled Task</DialogTitle>
              <DialogDescription>Set up an automated task to run on a schedule.</DialogDescription>
            </DialogHeader>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...createForm.register("name")}
                  placeholder="Daily report generation"
                />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {createForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  {...createForm.register("description")}
                  placeholder="What should this task do?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskType">Task Type</Label>
                <Select
                  value={createForm.watch("taskType")}
                  onValueChange={(value) =>
                    createForm.setValue("taskType", value as TaskFormValues["taskType"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent_run">AI Agent Task</SelectItem>
                    <SelectItem value="report">Generate Report</SelectItem>
                    <SelectItem value="sync">Data Sync</SelectItem>
                    <SelectItem value="backup">Backup</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduleType">Schedule</Label>
                <Select
                  value={createForm.watch("scheduleType")}
                  onValueChange={(value) =>
                    createForm.setValue("scheduleType", value as TaskFormValues["scheduleType"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                    <SelectItem value="cron">Cron Expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {renderScheduleFields(createForm, createScheduleType)}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pendingAction?.type === "create"}>
                  {pendingAction?.type === "create" && (
                    <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Create Task
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Task List */}
      {tasks && tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => {
            const status = statusConfig[task.status] || statusConfig.pending;
            const StatusIcon = status.icon;

            return (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {task.scheduleType === "recurring" ? (
                      <RepeatIcon className="h-5 w-5" />
                    ) : (
                      <ClockIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.name}</span>
                      <Badge variant={status.variant} className="gap-1 text-xs">
                        <StatusIcon
                          className={`h-3 w-3 ${task.status === "running" ? "animate-spin" : ""}`}
                        />
                        {task.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {taskTypeLabels[task.taskType] || task.taskType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {task.scheduleType === "recurring" && task.recurrencePattern && (
                        <>
                          {recurrenceLabels[task.recurrencePattern] || task.recurrencePattern}
                          {task.recurrenceTime && ` at ${task.recurrenceTime}`}
                        </>
                      )}
                      {task.scheduleType === "once" && task.scheduledAt && (
                        <>
                          Scheduled for {format(new Date(task.scheduledAt), "MMM d, yyyy h:mm a")}
                        </>
                      )}
                      {task.scheduleType === "cron" && task.cronExpression && (
                        <>Cron: {task.cronExpression}</>
                      )}
                      {task.nextRunAt && (
                        <> · Next run: {format(new Date(task.nextRunAt), "MMM d, h:mm a")}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Run Now */}
                  {task.status !== "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Run now"
                      onClick={async () => {
                        try {
                          setPendingAction({ type: "run", id: task.id });
                          await getTrpcClient().scheduledTasks.runNow.mutate({ id: task.id });
                          toast.success("Task triggered — running now");
                          refetch();
                        } catch (error: any) {
                          toast.error(error?.message || "Failed to run task");
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                      disabled={pendingAction?.id === task.id && pendingAction?.type === "run"}
                    >
                      <PlayIcon className="h-4 w-4 text-green-600" />
                    </Button>
                  )}

                  {/* Edit */}
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Edit"
                    onClick={() => openEditDialog(task)}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>

                  {/* Pause / Resume */}
                  {task.isEnabled && task.status !== "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Pause"
                      onClick={async () => {
                        try {
                          setPendingAction({ type: "pause", id: task.id });
                          const updated = await getTrpcClient().scheduledTasks.pause.mutate({
                            id: task.id,
                          });
                          dispatch(
                            updateScheduledTask({
                              id: updated.id,
                              updates: normalizeScheduledTask(updated),
                            })
                          );
                          toast.success("Task paused");
                        } catch (error: any) {
                          toast.error(error?.message || "Failed to pause task");
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                      disabled={pendingAction?.id === task.id && pendingAction?.type === "pause"}
                    >
                      <PauseIcon className="h-4 w-4" />
                    </Button>
                  )}

                  {!task.isEnabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Resume"
                      onClick={async () => {
                        try {
                          setPendingAction({ type: "resume", id: task.id });
                          const updated = await getTrpcClient().scheduledTasks.resume.mutate({
                            id: task.id,
                          });
                          dispatch(
                            updateScheduledTask({
                              id: updated.id,
                              updates: normalizeScheduledTask(updated),
                            })
                          );
                          toast.success("Task resumed");
                        } catch (error: any) {
                          toast.error(error?.message || "Failed to resume task");
                        } finally {
                          setPendingAction(null);
                        }
                      }}
                      disabled={pendingAction?.id === task.id && pendingAction?.type === "resume"}
                    >
                      <PlayIcon className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Delete */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete task?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{task.name}&quot; and all its execution
                          history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              setPendingAction({ type: "delete", id: task.id });
                              await getTrpcClient().scheduledTasks.delete.mutate({ id: task.id });
                              dispatch(deleteScheduledTask(task.id));
                              toast.success("Task deleted");
                            } catch (error: any) {
                              toast.error(error?.message || "Failed to delete task");
                            } finally {
                              setPendingAction(null);
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}

          {/* View All link */}
          <div className="pt-2 text-center">
            <Button variant="link" size="sm" asChild className="gap-1">
              <Link href="/actions?tab=schedules">
                View all scheduled tasks
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center">
          <ClockIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No scheduled tasks</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create automated tasks to run AI agents, generate reports, or sync data on a schedule.
          </p>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Create your first task
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editingTask !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Task</DialogTitle>
            <DialogDescription>Update the task configuration.</DialogDescription>
          </DialogHeader>

          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                {...editForm.register("name")}
                placeholder="Daily report generation"
              />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                {...editForm.register("description")}
                placeholder="What should this task do?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule</Label>
              <Select
                value={editForm.watch("scheduleType")}
                onValueChange={(value) =>
                  editForm.setValue("scheduleType", value as TaskFormValues["scheduleType"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="cron">Cron Expression</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {renderScheduleFields(editForm, editScheduleType)}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pendingAction?.type === "update" && pendingAction?.id === editingTask?.id}
              >
                {pendingAction?.type === "update" && pendingAction?.id === editingTask?.id && (
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
