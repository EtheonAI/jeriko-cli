"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Loader2Icon,
  MailIcon,
  SendIcon,
  InboxIcon,
  SettingsIcon,
  CopyIcon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { ErrorState } from "./error-state";

const emailSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  emailDigest: z.enum(["instant", "hourly", "daily", "weekly", "never"]),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
});

type EmailSettingsForm = z.infer<typeof emailSettingsSchema>;

export function MailManusTab() {
  const [copied, setCopied] = useState(false);

  // Fetch notification preferences
  const { data: preferences, isLoading, isError, refetch } = trpc.notifications.getPreferences.useQuery(undefined, { retry: 1 });

  // Mutations
  const utils = trpc.useUtils();

  const updatePreferences = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Email settings updated");
      utils.notifications.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  // Form
  const form = useForm<EmailSettingsForm>({
    resolver: zodResolver(emailSettingsSchema),
    values: preferences ? {
      emailEnabled: preferences.emailEnabled,
      emailDigest: preferences.emailDigest as EmailSettingsForm["emailDigest"],
      quietHoursEnabled: preferences.quietHoursEnabled,
      quietHoursStart: "quietHoursStart" in preferences ? (preferences.quietHoursStart || "") : "",
      quietHoursEnd: "quietHoursEnd" in preferences ? (preferences.quietHoursEnd || "") : "",
    } : undefined,
  });

  // Generate agent email address (demo)
  const agentEmail = "agent-abc123@mail.rubic.dev";

  const copyEmail = async () => {
    await navigator.clipboard.writeText(agentEmail);
    setCopied(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = (data: EmailSettingsForm) => {
    updatePreferences.mutate({
      emailEnabled: data.emailEnabled,
      emailDigest: data.emailDigest,
      quietHoursEnabled: data.quietHoursEnabled,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Mail Manus</h2>
          <p className="text-sm text-muted-foreground">
            Configure how Rubic handles email communications.
          </p>
        </div>
        <Separator />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Mail Manus</h2>
          <p className="text-sm text-muted-foreground">
            Configure how Rubic handles email communications.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load email settings"
          message="Unable to load your email preferences. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Mail Manus</h2>
        <p className="text-sm text-muted-foreground">
          Configure how Rubic handles email communications and agent emails.
        </p>
      </div>

      <Separator />

      {/* Agent Email Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <InboxIcon className="h-4 w-4" />
            Agent Email Address
          </CardTitle>
          <CardDescription>
            Forward emails to this address to have Rubic process them automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm">
              {agentEmail}
            </div>
            <Button variant="outline" size="sm" onClick={copyEmail}>
              {copied ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertCircleIcon className="h-4 w-4 mt-0.5 text-amber-600" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <strong>How to use:</strong> Forward important emails to this address,
              and Rubic will analyze them and take appropriate actions based on your configured rules.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Notification Settings */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MailIcon className="h-4 w-4" />
              Email Notifications
            </CardTitle>
            <CardDescription>
              Control how you receive email notifications from Rubic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive important updates via email
                </p>
              </div>
              <Switch
                checked={form.watch("emailEnabled")}
                onCheckedChange={(checked) => form.setValue("emailEnabled", checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Digest Frequency</Label>
              <Select
                value={form.watch("emailDigest")}
                onValueChange={(value) => form.setValue("emailDigest", value as EmailSettingsForm["emailDigest"])}
                disabled={!form.watch("emailEnabled")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="hourly">Hourly Digest</SelectItem>
                  <SelectItem value="daily">Daily Digest</SelectItem>
                  <SelectItem value="weekly">Weekly Digest</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often should we bundle notifications into emails
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Quiet Hours
            </CardTitle>
            <CardDescription>
              Pause email notifications during specific hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Quiet Hours</Label>
                <p className="text-xs text-muted-foreground">
                  No email notifications during quiet hours
                </p>
              </div>
              <Switch
                checked={form.watch("quietHoursEnabled")}
                onCheckedChange={(checked) => form.setValue("quietHoursEnabled", checked)}
              />
            </div>

            {form.watch("quietHoursEnabled") && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      {...form.register("quietHoursStart")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      {...form.register("quietHoursEnd")}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updatePreferences.isPending}>
            {updatePreferences.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </form>

      <Separator />

      {/* Email Whitelist Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <SendIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Email Whitelist</h4>
              <p className="text-xs text-muted-foreground">
                Only emails from verified senders will be processed by Rubic.
                Configure your whitelist in the Connectors settings to add trusted email addresses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
