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
  LinkIcon,
  SparklesIcon,
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

  // Fetch profile for dynamic email and notification preferences
  const { data: profile } = trpc.user.getProfile.useQuery(undefined, { retry: 1 });
  const { data: preferences, isLoading: prefsLoading } = trpc.user.getPreferences.useQuery(
    undefined,
    { retry: 1 }
  );
  const {
    data: notifPrefs,
    isLoading: notifLoading,
    isError: notifError,
    refetch,
  } = trpc.notifications.getPreferences.useQuery(undefined, { retry: 1 });

  const utils = trpc.useUtils();

  const updateNotifPreferences = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Email settings updated");
      utils.notifications.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  const updateUserPreferences = trpc.user.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Email processing preferences saved");
      utils.user.getPreferences.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save preferences");
    },
  });

  // Form
  const form = useForm<EmailSettingsForm>({
    resolver: zodResolver(emailSettingsSchema),
    values: notifPrefs
      ? {
          emailEnabled: notifPrefs.emailEnabled,
          emailDigest: notifPrefs.emailDigest as EmailSettingsForm["emailDigest"],
          quietHoursEnabled: notifPrefs.quietHoursEnabled,
          quietHoursStart:
            ((notifPrefs as Record<string, unknown>).quietHoursStart as string) || "",
          quietHoursEnd: ((notifPrefs as Record<string, unknown>).quietHoursEnd as string) || "",
        }
      : undefined,
  });

  // Dynamic agent email derived from user ID
  const agentEmail = profile?.id
    ? `agent-${profile.id.slice(0, 8)}@mail.rubic.dev`
    : "agent-...@mail.rubic.dev";

  const copyEmail = async () => {
    await navigator.clipboard.writeText(agentEmail);
    setCopied(true);
    toast.success("Email copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = (data: EmailSettingsForm) => {
    updateNotifPreferences.mutate({
      emailEnabled: data.emailEnabled,
      emailDigest: data.emailDigest,
      quietHoursEnabled: data.quietHoursEnabled,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
    });
  };

  const isLoading = prefsLoading || notifLoading;

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

  if (notifError) {
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
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertCircleIcon className="h-4 w-4 mt-0.5 text-amber-600" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <strong>How to use:</strong> Forward important emails to this address, and Rubic will
              analyze them and take appropriate actions based on your configured rules.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Email Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Connected Email Accounts
          </CardTitle>
          <CardDescription>Connect your email accounts for automatic processing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <MailIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Gmail</p>
                <p className="text-xs text-muted-foreground">Connect your Google account</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Coming Soon
              </Badge>
              <Button variant="outline" size="sm" disabled>
                Connect
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-muted">
                <MailIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Outlook</p>
                <p className="text-xs text-muted-foreground">Connect your Microsoft account</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Coming Soon
              </Badge>
              <Button variant="outline" size="sm" disabled>
                Connect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Processing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SparklesIcon className="h-4 w-4" />
            Email Processing
          </CardTitle>
          <CardDescription>Configure how Rubic processes incoming emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-summarize Emails</Label>
              <p className="text-xs text-muted-foreground">
                Automatically generate summaries for long emails
              </p>
            </div>
            <Switch
              checked={preferences?.autoSummarizeEmails ?? false}
              onCheckedChange={(checked) =>
                updateUserPreferences.mutate({ autoSummarizeEmails: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-categorize Emails</Label>
              <p className="text-xs text-muted-foreground">
                Automatically categorize and label incoming emails
              </p>
            </div>
            <Switch
              checked={preferences?.autoCategorizeEmails ?? false}
              onCheckedChange={(checked) =>
                updateUserPreferences.mutate({ autoCategorizeEmails: checked })
              }
            />
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
                <p className="text-xs text-muted-foreground">Receive important updates via email</p>
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
                onValueChange={(value) =>
                  form.setValue("emailDigest", value as EmailSettingsForm["emailDigest"])
                }
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
            <CardDescription>Pause email notifications during specific hours.</CardDescription>
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
                    <Input type="time" {...form.register("quietHoursStart")} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" {...form.register("quietHoursEnd")} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateNotifPreferences.isPending}>
            {updateNotifPreferences.isPending && (
              <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
            )}
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
                Only emails from verified senders will be processed by Rubic. Configure your
                whitelist in the Connectors settings to add trusted email addresses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
