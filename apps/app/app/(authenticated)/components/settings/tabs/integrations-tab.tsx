"use client";

import { useState, useCallback, useEffect } from "react";
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
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  RotateCcwIcon,
} from "lucide-react";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ErrorState } from "./error-state";

const createWebhookSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});

type CreateWebhookForm = z.infer<typeof createWebhookSchema>;

function DeliveryStatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    delivered: { variant: "default", label: "Delivered" },
    pending: { variant: "outline", label: "Pending" },
    retrying: { variant: "secondary", label: "Retrying" },
    failed: { variant: "destructive", label: "Failed" },
  };
  const config = variants[status] || { variant: "outline" as const, label: status };
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}

function DeliveryLogSection({ webhookId }: { webhookId: string }) {
  const [detailDeliveryId, setDetailDeliveryId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryDetail, setDeliveryDetail] = useState<any | null>(null);
  const [isRetryPending, setIsRetryPending] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getTrpcClient().webhooks.getDeliveries.query({
        webhookId,
        limit: 20,
        offset: 0,
      });
      setDeliveries(data);
    } catch {
      setDeliveries(null);
    } finally {
      setIsLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  useEffect(() => {
    if (!detailDeliveryId) {
      setDeliveryDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getTrpcClient().webhooks.getDeliveryDetails.query({
          deliveryId: detailDeliveryId,
          webhookId,
        });
        if (!cancelled) setDeliveryDetail(data);
      } catch {
        if (!cancelled) setDeliveryDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailDeliveryId, webhookId]);

  const retryDelivery = useCallback(
    async (deliveryId: string) => {
      try {
        setIsRetryPending(true);
        await getTrpcClient().webhooks.retryDelivery.mutate({ deliveryId, webhookId });
        toast.success("Delivery queued for retry");
        fetchDeliveries();
      } catch (error: any) {
        toast.error(error.message || "Failed to retry delivery");
      } finally {
        setIsRetryPending(false);
      }
    },
    [webhookId, fetchDeliveries]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 mt-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <div className="mt-3 text-center py-4 border rounded-lg bg-muted/20">
        <ClockIcon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">No deliveries yet</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">Recent Deliveries</p>
      <div className="border rounded-lg divide-y">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <DeliveryStatusBadge status={delivery.status} />
                <span className="text-xs font-mono truncate">{delivery.eventType}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {delivery.responseStatus && (
                  <span className="text-xs text-muted-foreground">{delivery.responseStatus}</span>
                )}
                {delivery.durationMs != null && (
                  <span className="text-xs text-muted-foreground">{delivery.durationMs}ms</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true })}
                </span>
                {delivery.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => retryDelivery(delivery.id)}
                    disabled={isRetryPending}
                  >
                    <RotateCcwIcon className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() =>
                    setDetailDeliveryId(detailDeliveryId === delivery.id ? null : delivery.id)
                  }
                >
                  {detailDeliveryId === delivery.id ? (
                    <ChevronDownIcon className="h-3 w-3" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            {detailDeliveryId === delivery.id && deliveryDetail && (
              <div className="mt-2 space-y-2 text-xs">
                {deliveryDetail.error && (
                  <div className="bg-destructive/10 text-destructive rounded p-2">
                    {deliveryDetail.error}
                  </div>
                )}
                {deliveryDetail.requestHeaders && (
                  <div>
                    <p className="font-medium mb-1">Request Headers</p>
                    <pre className="bg-muted rounded p-2 overflow-x-auto">
                      {JSON.stringify(deliveryDetail.requestHeaders, null, 2)}
                    </pre>
                  </div>
                )}
                {deliveryDetail.requestBody && (
                  <div>
                    <p className="font-medium mb-1">Request Body</p>
                    <pre className="bg-muted rounded p-2 overflow-x-auto max-h-32">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(deliveryDetail.requestBody), null, 2);
                        } catch {
                          return deliveryDetail.requestBody;
                        }
                      })()}
                    </pre>
                  </div>
                )}
                {deliveryDetail.responseHeaders && (
                  <div>
                    <p className="font-medium mb-1">Response Headers</p>
                    <pre className="bg-muted rounded p-2 overflow-x-auto">
                      {JSON.stringify(deliveryDetail.responseHeaders, null, 2)}
                    </pre>
                  </div>
                )}
                {deliveryDetail.responseBody && (
                  <div>
                    <p className="font-medium mb-1">Response Body</p>
                    <pre className="bg-muted rounded p-2 overflow-x-auto max-h-32">
                      {deliveryDetail.responseBody}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntegrationsTab() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<any[] | null>(null);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(true);
  const [isWebhooksError, setIsWebhooksError] = useState(false);
  const [eventTypes, setEventTypes] = useState<any[] | null>(null);

  // Mutation pending states
  const [isCreatePending, setIsCreatePending] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [isTestPending, setIsTestPending] = useState(false);
  const [isRegeneratePending, setIsRegeneratePending] = useState(false);

  // Fetch webhooks
  const fetchWebhooks = useCallback(async () => {
    try {
      setIsLoadingWebhooks(true);
      setIsWebhooksError(false);
      const data = await getTrpcClient().webhooks.list.query();
      setWebhooks(data);
    } catch {
      setIsWebhooksError(true);
      setWebhooks(null);
    } finally {
      setIsLoadingWebhooks(false);
    }
  }, []);

  const fetchEventTypes = useCallback(async () => {
    try {
      const data = await getTrpcClient().webhooks.getEventTypes.query();
      setEventTypes(data);
    } catch {
      setEventTypes(null);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
    fetchEventTypes();
  }, [fetchWebhooks, fetchEventTypes]);

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

  // Mutations
  const createWebhook = useCallback(
    async (data: { name: string; url: string; events: any[] }) => {
      try {
        setIsCreatePending(true);
        await getTrpcClient().webhooks.create.mutate(data);
        toast.success("Webhook created");
        fetchWebhooks();
        setIsCreateOpen(false);
        form.reset();
      } catch (error: any) {
        toast.error(error.message || "Failed to create webhook");
      } finally {
        setIsCreatePending(false);
      }
    },
    [fetchWebhooks, form]
  );

  const deleteWebhook = useCallback(
    async (id: string) => {
      try {
        setIsDeletePending(true);
        await getTrpcClient().webhooks.delete.mutate({ id });
        toast.success("Webhook deleted");
        fetchWebhooks();
      } catch (error: any) {
        toast.error(error.message || "Failed to delete webhook");
      } finally {
        setIsDeletePending(false);
      }
    },
    [fetchWebhooks]
  );

  const testWebhook = useCallback(async (id: string) => {
    try {
      setIsTestPending(true);
      const result = await getTrpcClient().webhooks.test.mutate({ id });
      if (result.success) {
        toast.success(`Test successful (${result.status})`);
      } else {
        toast.error(`Test failed: ${result.error || result.statusText}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to test webhook");
    } finally {
      setIsTestPending(false);
    }
  }, []);

  const regenerateSecret = useCallback(
    async (id: string) => {
      try {
        setIsRegeneratePending(true);
        await getTrpcClient().webhooks.regenerateSecret.mutate({ id });
        toast.success("Secret regenerated");
        fetchWebhooks();
      } catch (error: any) {
        toast.error(error.message || "Failed to regenerate secret");
      } finally {
        setIsRegeneratePending(false);
      }
    },
    [fetchWebhooks]
  );

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  const onSubmit = (data: CreateWebhookForm) => {
    createWebhook({
      name: data.name,
      url: data.url,
      events: data.events as any[],
    });
  };

  // Group event types by category
  const groupedEvents =
    eventTypes?.reduce(
      (acc, event) => {
        const cat = event.category ?? "other";
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat]!.push(event);
        return acc;
      },
      {} as Record<string, typeof eventTypes>
    ) || {};

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
          onRetry={() => fetchWebhooks()}
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
                  <Input id="name" {...form.register("name")} placeholder="My Webhook" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
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
                    <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
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
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreatePending}>
                    {isCreatePending && (
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
                    <div className="space-y-2 flex-1 min-w-0">
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
                      <p className="text-xs text-muted-foreground font-mono">{webhook.url}</p>
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
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{webhook.totalDeliveries} total</span>
                        <span className="text-green-600">
                          {webhook.successfulDeliveries} succeeded
                        </span>
                        {webhook.failedDeliveries > 0 && (
                          <span className="text-destructive">
                            {webhook.failedDeliveries} failed
                          </span>
                        )}
                        {webhook.lastDeliveryAt && (
                          <span>
                            Last:{" "}
                            {formatDistanceToNow(new Date(webhook.lastDeliveryAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                      {/* Secret */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Secret:</span>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {showSecret === webhook.id ? webhook.secret : "whsec_••••••••••••••••"}
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
                        onClick={() =>
                          setExpandedWebhook(expandedWebhook === webhook.id ? null : webhook.id)
                        }
                        title="Delivery logs"
                      >
                        {expandedWebhook === webhook.id ? (
                          <ChevronDownIcon className="h-4 w-4" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testWebhook(webhook.id)}
                        disabled={isTestPending}
                        title="Send test"
                      >
                        {isTestPending ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLinkIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => regenerateSecret(webhook.id)}
                        disabled={isRegeneratePending}
                        title="Regenerate secret"
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
                              This will permanently delete this webhook and stop all deliveries.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteWebhook(webhook.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Delivery Logs */}
                  {expandedWebhook === webhook.id && <DeliveryLogSection webhookId={webhook.id} />}
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
      <ApiKeysSection />
    </div>
  );
}

// ============================================================
// API Keys Section
// ============================================================

function ApiKeysSection() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Default");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Data state
  const [apiKeysList, setApiKeysList] = useState<any[] | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isKeysError, setIsKeysError] = useState(false);

  // Mutation pending states
  const [isCreateKeyPending, setIsCreateKeyPending] = useState(false);
  const [isRevokePending, setIsRevokePending] = useState(false);
  const [isDeleteKeyPending, setIsDeleteKeyPending] = useState(false);
  const [isRenamePending, setIsRenamePending] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      setIsLoadingKeys(true);
      setIsKeysError(false);
      const data = await getTrpcClient().apiKeys.list.query();
      setApiKeysList(data);
    } catch {
      setIsKeysError(true);
      setApiKeysList(null);
    } finally {
      setIsLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const createKey = useCallback(
    async (name: string) => {
      try {
        setIsCreateKeyPending(true);
        const data = await getTrpcClient().apiKeys.create.mutate({ name });
        setRevealedKey(data.key);
        fetchKeys();
        setIsCreateOpen(false);
        setNewKeyName("Default");
        toast.success("API key created. Copy it now — it won't be shown again.");
      } catch (error: any) {
        toast.error(error.message || "Failed to create API key");
      } finally {
        setIsCreateKeyPending(false);
      }
    },
    [fetchKeys]
  );

  const revokeKey = useCallback(
    async (id: string) => {
      try {
        setIsRevokePending(true);
        await getTrpcClient().apiKeys.revoke.mutate({ id });
        toast.success("API key revoked");
        fetchKeys();
      } catch (error: any) {
        toast.error(error.message || "Failed to revoke API key");
      } finally {
        setIsRevokePending(false);
      }
    },
    [fetchKeys]
  );

  const deleteKey = useCallback(
    async (id: string) => {
      try {
        setIsDeleteKeyPending(true);
        await getTrpcClient().apiKeys.delete.mutate({ id });
        toast.success("API key deleted");
        fetchKeys();
      } catch (error: any) {
        toast.error(error.message || "Failed to delete API key");
      } finally {
        setIsDeleteKeyPending(false);
      }
    },
    [fetchKeys]
  );

  const renameKey = useCallback(
    async (id: string, name: string) => {
      try {
        setIsRenamePending(true);
        await getTrpcClient().apiKeys.rename.mutate({ id, name });
        toast.success("API key renamed");
        fetchKeys();
        setEditingKeyId(null);
      } catch (error: any) {
        toast.error(error.message || "Failed to rename API key");
      } finally {
        setIsRenamePending(false);
      }
    },
    [fetchKeys]
  );

  const copyApiKey = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (isLoadingKeys) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h3 className="text-sm font-medium">API Keys</h3>
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isKeysError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h3 className="text-sm font-medium">API Keys</h3>
        </div>
        <ErrorState
          title="Failed to load API keys"
          message="Unable to load your API keys. Please try again."
          onRetry={() => fetchKeys()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h3 className="text-sm font-medium">API Keys</h3>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key to access Rubic programmatically. The key will only be shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="My App"
                maxLength={100}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createKey(newKeyName)}
                disabled={isCreateKeyPending || !newKeyName.trim()}
              >
                {isCreateKeyPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Create Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Show newly created key */}
      {revealedKey && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600">
                Your new API key (copy it now — it won't be shown again):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                  {revealedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyApiKey(revealedKey, "new-key")}
                >
                  {copiedKey === "new-key" ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setRevealedKey(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {apiKeysList && apiKeysList.length > 0 ? (
        <div className="space-y-2">
          {apiKeysList.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    {editingKeyId === apiKey.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm"
                          maxLength={100}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editName.trim()) {
                              renameKey(apiKey.id, editName);
                            }
                            if (e.key === "Escape") setEditingKeyId(null);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            if (editName.trim()) {
                              renameKey(apiKey.id, editName);
                            }
                          }}
                          disabled={isRenamePending}
                        >
                          <CheckIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium cursor-pointer hover:underline"
                          onClick={() => {
                            setEditingKeyId(apiKey.id);
                            setEditName(apiKey.name);
                          }}
                        >
                          {apiKey.name}
                        </span>
                        <Badge
                          variant={apiKey.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {apiKey.isActive ? "Active" : "Revoked"}
                        </Badge>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-muted-foreground font-mono">
                        {apiKey.keyPrefix}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {apiKey.totalRequests} requests
                      </span>
                      {apiKey.lastUsedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last used{" "}
                          {formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Created{" "}
                        {format(new Date(apiKey.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {apiKey.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Revoke key"
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will deactivate the key "{apiKey.name}". Any applications using this key will stop working.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revokeKey(apiKey.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          title="Delete key"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the key "{apiKey.name}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteKey(apiKey.id)}
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
              <KeyIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No API keys</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create an API key to access Rubic programmatically.
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <PlusIcon className="h-4 w-4" />
                Create your first API key
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
