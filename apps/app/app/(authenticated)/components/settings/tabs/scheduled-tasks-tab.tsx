"use client";

import { useState } from "react";
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
import { Switch } from "@repo/design-system/components/ui/switch";
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
  AlertCircleIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

// Status badge config
const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
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

const createTaskSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]),
  scheduleType: z.enum(["once", "recurring", "cron"]),
  scheduledAt: z.string().optional(),
  recurrencePattern: z.enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"]).optional(),
  recurrenceTime: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string(),
});

type CreateTaskForm = z.infer<typeof createTaskSchema>;

export function ScheduledTasksTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch tasks
  const { data: tasks, isLoading, isError, refetch } = trpc.scheduledTasks.list.useQuery({}, { retry: 1 });

  // Mutations
  const utils = trpc.useUtils();

  const createTask = trpc.scheduledTasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task scheduled successfully");
      utils.scheduledTasks.list.invalidate();
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create task");
    },
  });

  const pauseTask = trpc.scheduledTasks.pause.useMutation({
    onSuccess: () => {
      toast.success("Task paused");
      utils.scheduledTasks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to pause task");
    },
  });

  const resumeTask = trpc.scheduledTasks.resume.useMutation({
    onSuccess: () => {
      toast.success("Task resumed");
      utils.scheduledTasks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resume task");
    },
  });

  const deleteTask = trpc.scheduledTasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      utils.scheduledTasks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete task");
    },
  });

  // Form
  const form = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      name: "",
      description: "",
      taskType: "agent_run",
      scheduleType: "recurring",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const scheduleType = form.watch("scheduleType");

  const onSubmit = (data: CreateTaskForm) => {
    const submitData: Parameters<typeof createTask.mutate>[0] = {
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

    createTask.mutate(submitData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Automate recurring tasks and workflows.
            </p>
          </div>
        </div>
        <Separator />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scheduled Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Automate recurring tasks and workflows.
            </p>
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
          <p className="text-sm text-muted-foreground">
            Automate recurring tasks and workflows.
          </p>
        </div>

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
              <DialogDescription>
                Set up an automated task to run on a schedule.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Daily report generation"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="What should this task do?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskType">Task Type</Label>
                <Select
                  value={form.watch("taskType")}
                  onValueChange={(value) => form.setValue("taskType", value as CreateTaskForm["taskType"])}
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
                  value={form.watch("scheduleType")}
                  onValueChange={(value) => form.setValue("scheduleType", value as CreateTaskForm["scheduleType"])}
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

              {scheduleType === "once" && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Run at</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    {...form.register("scheduledAt")}
                  />
                </div>
              )}

              {scheduleType === "recurring" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="recurrencePattern">Frequency</Label>
                    <Select
                      value={form.watch("recurrencePattern")}
                      onValueChange={(value) => form.setValue("recurrencePattern", value as CreateTaskForm["recurrencePattern"])}
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
                    <Input
                      id="recurrenceTime"
                      type="time"
                      {...form.register("recurrenceTime")}
                    />
                  </div>
                </>
              )}

              {scheduleType === "cron" && (
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createTask.isPending}>
                  {createTask.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
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
                        <StatusIcon className={`h-3 w-3 ${task.status === "running" ? "animate-spin" : ""}`} />
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
                        <>Scheduled for {format(new Date(task.scheduledAt), "MMM d, yyyy h:mm a")}</>
                      )}
                      {task.scheduleType === "cron" && task.cronExpression && (
                        <>Cron: {task.cronExpression}</>
                      )}
                      {task.nextRunAt && (
                        <> • Next run: {format(new Date(task.nextRunAt), "MMM d, h:mm a")}</>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {task.isEnabled && task.status !== "running" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => pauseTask.mutate({ id: task.id })}
                      disabled={pauseTask.isPending}
                    >
                      <PauseIcon className="h-4 w-4" />
                    </Button>
                  )}

                  {!task.isEnabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resumeTask.mutate({ id: task.id })}
                      disabled={resumeTask.isPending}
                    >
                      <PlayIcon className="h-4 w-4" />
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete task?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{task.name}&quot; and all its execution history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteTask.mutate({ id: task.id })}
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
    </div>
  );
}
