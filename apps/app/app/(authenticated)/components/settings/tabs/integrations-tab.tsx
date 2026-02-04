"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
  WebhookIcon,
  KeyIcon,
  CopyIcon,
  CheckIcon,
  TrashIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

const createWebhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});

type CreateWebhookForm = z.infer<typeof createWebhookSchema>;

export function IntegrationsTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Fetch webhooks
  const { data: webhooks, isLoading: isLoadingWebhooks, isError: isWebhooksError, refetch: refetchWebhooks } = trpc.webhooks.list.useQuery(undefined, { retry: 1 });
  const { data: eventTypes } = trpc.webhooks.getEventTypes.useQuery(undefined, { retry: 1 });

  // Mutations
  const utils = trpc.useUtils();

  const createWebhook = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      toast.success("Webhook created");
      utils.webhooks.list.invalidate();
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create webhook");
    },
  });

  const deleteWebhook = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      toast.success("Webhook deleted");
      utils.webhooks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete webhook");
    },
  });

  const testWebhook = trpc.webhooks.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Test successful (${result.status})`);
      } else {
        toast.error(`Test failed: ${result.error || result.statusText}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to test webhook");
    },
  });

  const regenerateSecret = trpc.webhooks.regenerateSecret.useMutation({
    onSuccess: () => {
      toast.success("Secret regenerated");
      utils.webhooks.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate secret");
    },
  });

  // Form
  const form = useForm<CreateWebhookForm>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: {
      name: "",
      url: "",
      events: [],
    },
  });

  const selectedEvents = form.watch("events");

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  const onSubmit = (data: CreateWebhookForm) => {
    createWebhook.mutate({
      name: data.name,
      url: data.url,
      events: data.events as any[],
    });
  };

  // Group event types by category
  const groupedEvents = eventTypes?.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, typeof eventTypes>) || {};

  if (isLoadingWebhooks) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect Rubic to your other services via webhooks and APIs.
          </p>
        </div>
        <Separator />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isWebhooksError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Connect Rubic to your other services via webhooks and APIs.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load integrations"
          message="Unable to load your webhooks. Please try again."
          onRetry={() => refetchWebhooks()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">
          Connect Rubic to your other services via webhooks and APIs.
        </p>
      </div>

      <Separator />

      {/* Webhooks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WebhookIcon className="h-5 w-5" />
            <h3 className="text-sm font-medium">Webhooks</h3>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <PlusIcon className="h-4 w-4" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Webhook</DialogTitle>
                <DialogDescription>
                  Receive real-time notifications when events occur in Rubic.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="My Webhook"
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">Endpoint URL</Label>
                  <Input
                    id="url"
                    {...form.register("url")}
                    placeholder="https://your-server.com/webhook"
                  />
                  {form.formState.errors.url && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.url.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="rounded-lg border max-h-48 overflow-y-auto p-3 space-y-4">
                    {Object.entries(groupedEvents).map(([category, events]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          {category}
                        </p>
                        {events.map((event) => (
                          <div key={event.value} className="flex items-center gap-2">
                            <Checkbox
                              id={event.value}
                              checked={selectedEvents.includes(event.value)}
                              onCheckedChange={(checked) => {
                                const current = form.getValues("events");
                                if (checked) {
                                  form.setValue("events", [...current, event.value]);
                                } else {
                                  form.setValue(
                                    "events",
                                    current.filter((e) => e !== event.value)
                                  );
                                }
                              }}
                            />
                            <Label
                              htmlFor={event.value}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {event.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  {form.formState.errors.events && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.events.message}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createWebhook.isPending}>
                    {createWebhook.isPending && (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Create Webhook
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {webhooks && webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{webhook.name}</span>
                        <Badge
                          variant={webhook.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {webhook.status === "active" ? (
                            <CheckCircle2Icon className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircleIcon className="h-3 w-3 mr-1" />
                          )}
                          {webhook.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {webhook.url}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(webhook.events as string[])?.slice(0, 3).map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {(webhook.events as string[])?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{(webhook.events as string[]).length - 3} more
                          </Badge>
                        )}
                      </div>
                      {/* Secret */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Secret:</span>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {showSecret === webhook.id
                            ? webhook.secret
                            : "whsec_••••••••••••••••"}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() =>
                            setShowSecret(showSecret === webhook.id ? null : webhook.id)
                          }
                        >
                          {showSecret === webhook.id ? (
                            <EyeOffIcon className="h-3 w-3" />
                          ) : (
                            <EyeIcon className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(webhook.secret, webhook.id)}
                        >
                          {copied === webhook.id ? (
                            <CheckIcon className="h-3 w-3" />
                          ) : (
                            <CopyIcon className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testWebhook.mutate({ id: webhook.id })}
                        disabled={testWebhook.isPending}
                      >
                        {testWebhook.isPending ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLinkIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateSecret.mutate({ id: webhook.id })}
                        disabled={regenerateSecret.isPending}
                      >
                        <RefreshCwIcon className="h-4 w-4" />
                      </Button>
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
                            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this webhook and stop all
                              deliveries.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteWebhook.mutate({ id: webhook.id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <WebhookIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a webhook to receive real-time notifications.
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Create your first webhook
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* API Keys Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h3 className="text-sm font-medium">API Keys</h3>
        </div>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-center py-4">
              <KeyIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h4 className="text-sm font-medium mb-1">API Access Coming Soon</h4>
              <p className="text-xs text-muted-foreground">
                Generate API keys to access Rubic programmatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
