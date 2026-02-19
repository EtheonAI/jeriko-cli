"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Loader2Icon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch } from "@/lib/store/hooks";
import { updateScheduledTask, type ScheduledTask } from "@/lib/store/slices/scheduledTasks.slice";
import { normalizeScheduledTask } from "@/lib/store/hooks/useScheduledTasksData";
import { useUpdateScheduledTaskMutation } from "@/lib/store/api/api.slice";
import { SkillsPicker } from "./skills-picker";
import { ConnectorPicker } from "./connector-picker";

const editFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  prompt: z.string().optional(),
  recurrencePattern: z
    .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"])
    .optional(),
  recurrenceTime: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

interface EditAutomationDialogProps {
  task: ScheduledTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAutomationDialog({ task, open, onOpenChange }: EditAutomationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);
  const dispatch = useAppDispatch();
  const [updateScheduledTaskMutation] = useUpdateScheduledTaskMutation();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: "",
      description: "",
      prompt: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  // Populate form when task changes
  useEffect(() => {
    if (task && open) {
      form.reset({
        name: task.name,
        description: task.description || "",
        prompt: (task.payload as any)?.prompt || "",
        recurrencePattern: (task.recurrencePattern as EditFormValues["recurrencePattern"]) ?? undefined,
        recurrenceTime: task.recurrenceTime ?? undefined,
        cronExpression: task.cronExpression ?? undefined,
        timezone: task.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setTriggerConfig(task.triggerConfig || {});
      const payloadSkills = (task.payload as Record<string, unknown> | null)?.skillIds;
      setSelectedSkills(Array.isArray(payloadSkills) ? (payloadSkills as string[]) : []);
      const payloadConnectors = (task.payload as Record<string, unknown> | null)?.connectionIds;
      setSelectedConnectors(Array.isArray(payloadConnectors) ? (payloadConnectors as string[]) : []);
      setIsSubmitting(false);
    }
  }, [task, open, form]);

  function handleClose() {
    onOpenChange(false);
  }

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) {
      const errors = form.formState.errors;
      const firstError = Object.values(errors)[0];
      toast.error(
        (firstError as any)?.message || "Please fix the form errors before saving",
      );
      return;
    }

    const data = form.getValues();
    if (!task) return;

    const submitData: Record<string, any> = {
      id: task.id,
      name: data.name,
      description: data.description,
      timezone: data.timezone || task.timezone || "UTC",
    };

    // Update payload with prompt, skillIds, and connectionIds
    submitData.payload = {
      ...((task.payload as Record<string, unknown>) || {}),
      prompt: data.prompt,
      skillIds: selectedSkills.length > 0 ? selectedSkills : undefined,
      connectionIds: selectedConnectors.length > 0 ? selectedConnectors : undefined,
    };

    if (task.scheduleType === "recurring") {
      submitData.recurrencePattern = data.recurrencePattern;
      submitData.recurrenceTime = data.recurrenceTime;
    }
    if (task.scheduleType === "cron") {
      submitData.cronExpression = data.cronExpression;
    }
    if (task.scheduleType === "trigger" && Object.keys(triggerConfig).length > 0) {
      submitData.triggerConfig = triggerConfig;
    }

    try {
      setIsSubmitting(true);
      const updated = await updateScheduledTaskMutation(submitData as any).unwrap();
      if (updated) {
        dispatch(
          updateScheduledTask({
            id: (updated as any).id,
            updates: normalizeScheduledTask(updated),
          }),
        );
      }
      toast.success("Automation updated");
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update automation");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Automation</DialogTitle>
          <DialogDescription>Update your automation configuration.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea id="edit-description" {...form.register("description")} rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-prompt">Prompt</Label>
            <Textarea
              id="edit-prompt"
              {...form.register("prompt")}
              placeholder="Instructions for the AI agent..."
              rows={3}
            />
          </div>

          <SkillsPicker selected={selectedSkills} onChange={setSelectedSkills} />

          <ConnectorPicker selected={selectedConnectors} onChange={setSelectedConnectors} />

          {/* Trigger info (read-only app/event, editable config) */}
          {task.scheduleType === "trigger" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Trigger</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <ZapIcon className="h-3 w-3" />
                  {task.triggerAppName
                    ? task.triggerAppName.charAt(0).toUpperCase() + task.triggerAppName.slice(1)
                    : "Unknown"}
                </Badge>
                <span className="text-sm text-muted-foreground">{task.triggerEventSlug}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                To change the trigger app or event, delete this automation and create a new one.
              </p>
              {task.triggerConfig && Object.keys(task.triggerConfig).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Trigger Config</Label>
                  {Object.entries(task.triggerConfig).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`edit-tc-${key}`} className="text-xs">
                        {key}
                      </Label>
                      <Input
                        id={`edit-tc-${key}`}
                        value={String(triggerConfig[key] ?? value ?? "")}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, [key]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schedule-specific fields */}
          {task.scheduleType === "recurring" && (
            <>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={form.watch("recurrencePattern")}
                  onValueChange={(value) =>
                    form.setValue("recurrencePattern", value as EditFormValues["recurrencePattern"])
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
                <Label htmlFor="edit-recurrenceTime">Time</Label>
                <Input id="edit-recurrenceTime" type="time" {...form.register("recurrenceTime")} />
              </div>
            </>
          )}

          {task.scheduleType === "cron" && (
            <div className="space-y-2">
              <Label htmlFor="edit-cronExpression">Cron Expression</Label>
              <Input
                id="edit-cronExpression"
                {...form.register("cronExpression")}
                placeholder="0 9 * * 1-5"
              />
              <p className="text-xs text-muted-foreground">
                Example: &quot;0 9 * * 1-5&quot; runs at 9 AM on weekdays
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="button" disabled={isSubmitting} onClick={handleSave}>
              {isSubmitting && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
