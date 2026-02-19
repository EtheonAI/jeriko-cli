"use client";

import { useState } from "react";
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
import {
  ZapIcon,
  RepeatIcon,
  ClockIcon,
  CodeIcon,
  Loader2Icon,
  ArrowLeftIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch } from "@/lib/store/hooks";
import { addScheduledTask } from "@/lib/store/slices/scheduledTasks.slice";
import { normalizeScheduledTask } from "@/lib/store/hooks/useScheduledTasksData";
import { useCreateScheduledTaskMutation } from "@/lib/store/api/api.slice";
import { TriggerSelector } from "./trigger-selector";
import { SkillsPicker } from "./skills-picker";
import { ConnectorPicker } from "./connector-picker";

const automationFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional(),
  taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]),
  scheduleType: z.enum(["once", "recurring", "cron", "trigger"]),
  prompt: z.string().optional(),
  scheduledAt: z.string().optional(),
  recurrencePattern: z
    .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"])
    .optional(),
  recurrenceTime: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string(),
});

type AutomationFormValues = z.infer<typeof automationFormSchema>;

const typeCards = [
  {
    type: "trigger" as const,
    label: "Trigger",
    description: "Runs when an event occurs in a connected app",
    icon: ZapIcon,
  },
  {
    type: "recurring" as const,
    label: "Recurring",
    description: "Runs on a repeating schedule",
    icon: RepeatIcon,
  },
  {
    type: "once" as const,
    label: "One-time",
    description: "Runs once at a specific time",
    icon: ClockIcon,
  },
  {
    type: "cron" as const,
    label: "Cron",
    description: "Runs on a custom cron schedule",
    icon: CodeIcon,
  },
];

interface CreateAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAutomationDialog({ open, onOpenChange }: CreateAutomationDialogProps) {
  const [step, setStep] = useState<"type" | "config">("type");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggerApp, setTriggerApp] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([]);
  const dispatch = useAppDispatch();
  const [createScheduledTask] = useCreateScheduledTaskMutation();

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      name: "",
      description: "",
      taskType: "agent_run",
      scheduleType: "recurring",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const scheduleType = form.watch("scheduleType");

  function handleTypeSelect(type: AutomationFormValues["scheduleType"]) {
    form.setValue("scheduleType", type);
    if (type === "recurring") {
      form.setValue("recurrencePattern", "daily");
    }
    setStep("config");
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setStep("type");
      setTriggerApp("");
      setTriggerEvent("");
      setTriggerConfig({});
      setSelectedSkills([]);
      setSelectedConnectors([]);
      form.reset();
    }, 200);
  }

  async function onSubmit(data: AutomationFormValues) {
    const submitData: Record<string, any> = {
      name: data.name,
      description: data.description,
      taskType: data.taskType,
      scheduleType: data.scheduleType,
      timezone: data.timezone,
    };

    // Add prompt, skillIds, and connectionIds to payload
    if (data.prompt || selectedSkills.length > 0 || selectedConnectors.length > 0) {
      submitData.payload = {
        ...(data.prompt ? { prompt: data.prompt } : {}),
        ...(selectedSkills.length > 0 ? { skillIds: selectedSkills } : {}),
        ...(selectedConnectors.length > 0 ? { connectionIds: selectedConnectors } : {}),
      };
    }

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
    if (data.scheduleType === "trigger") {
      if (!triggerApp || !triggerEvent) {
        toast.error("Please select a trigger app and event");
        return;
      }
      submitData.triggerEnabled = true;
      submitData.triggerAppName = triggerApp;
      submitData.triggerEventSlug = triggerEvent;
      if (Object.keys(triggerConfig).length > 0) {
        submitData.triggerConfig = triggerConfig;
      }
    }

    try {
      setIsSubmitting(true);
      const created = await createScheduledTask(submitData as any).unwrap();
      dispatch(addScheduledTask(normalizeScheduledTask(created)));
      toast.success("Automation created");
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create automation");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "type" ? "Create Automation" : "Configure Automation"}
          </DialogTitle>
          <DialogDescription>
            {step === "type"
              ? "Choose how your automation will be triggered."
              : "Set up your automation details."}
          </DialogDescription>
        </DialogHeader>

        {step === "type" && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {typeCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.type}
                  type="button"
                  onClick={() => handleTypeSelect(card.type)}
                  className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{card.label}</div>
                    <div className="text-xs text-muted-foreground">{card.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === "config" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit(onSubmit)(e);
            }}
            className="space-y-4"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 mb-1"
              onClick={() => setStep("type")}
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              Change type
            </Button>

            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                {...form.register("name")}
                placeholder="e.g., Summarize new emails"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-description">Description (optional)</Label>
              <Textarea
                id="create-description"
                {...form.register("description")}
                placeholder="What should this automation do?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-prompt">Prompt</Label>
              <Textarea
                id="create-prompt"
                {...form.register("prompt")}
                placeholder="Instructions for the AI agent when this automation runs..."
                rows={3}
              />
            </div>

            <SkillsPicker selected={selectedSkills} onChange={setSelectedSkills} />

            <ConnectorPicker selected={selectedConnectors} onChange={setSelectedConnectors} />

            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select
                value={form.watch("taskType")}
                onValueChange={(value) =>
                  form.setValue("taskType", value as AutomationFormValues["taskType"])
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

            {/* Trigger-specific fields */}
            {scheduleType === "trigger" && (
              <TriggerSelector
                selectedApp={triggerApp}
                selectedEvent={triggerEvent}
                triggerConfig={triggerConfig}
                onAppChange={setTriggerApp}
                onEventChange={setTriggerEvent}
                onConfigChange={setTriggerConfig}
              />
            )}

            {/* Schedule-specific fields */}
            {scheduleType === "once" && (
              <div className="space-y-2">
                <Label htmlFor="create-scheduledAt">Run at</Label>
                <Input id="create-scheduledAt" type="datetime-local" {...form.register("scheduledAt")} />
              </div>
            )}

            {scheduleType === "recurring" && (
              <>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={form.watch("recurrencePattern")}
                    onValueChange={(value) =>
                      form.setValue(
                        "recurrencePattern",
                        value as AutomationFormValues["recurrencePattern"]
                      )
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
                  <Label htmlFor="create-recurrenceTime">Time</Label>
                  <Input id="create-recurrenceTime" type="time" {...form.register("recurrenceTime")} />
                </div>
              </>
            )}

            {scheduleType === "cron" && (
              <div className="space-y-2">
                <Label htmlFor="create-cronExpression">Cron Expression</Label>
                <Input
                  id="create-cronExpression"
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Create Automation
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
