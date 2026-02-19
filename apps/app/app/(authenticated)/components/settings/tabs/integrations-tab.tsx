"use client";

import { useState, useCallback, useRef } from "react";
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
import {
  useGetWebhooksQuery,
  useGetWebhookEventTypesQuery,
  useGetWebhookDeliveriesQuery,
  useCreateWebhookMutation,
  useDeleteWebhookMutation,
  useTestWebhookMutation,
  useRegenerateWebhookSecretMutation,
  useGetWebhookDeliveryDetailsQuery,
  useRetryWebhookDeliveryMutation,
  useGetApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useDeleteApiKeyMutation,
  useRenameApiKeyMutation,
} from "@/lib/store/api/api.slice";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ErrorState } from "./error-state";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setApiKeys,
  addApiKey,
  removeApiKey,
  setApiKeysLoading,
  setEnterpriseTeamError,
  type ApiKey,
} from "@/lib/store/slices/enterpriseTeam.slice";

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

  // RTK Query for deliveries
  const { data: deliveries, isLoading, refetch: refetchDeliveries } = useGetWebhookDeliveriesQuery(
    { webhookId, limit: 20, offset: 0 },
    { selectFromResult: ({ data, ...rest }) => ({ data: (data as any[] | undefined) ?? null, ...rest }) }
  );

  // RTK Query for delivery details — auto-fetches when deliveryId changes
  const { data: deliveryDetail } = useGetWebhookDeliveryDetailsQuery(
    { deliveryId: detailDeliveryId!, webhookId },
    {
      skip: !detailDeliveryId,
      selectFromResult: ({ data, ...rest }) => ({ data: (data ?? null) as any, ...rest }),
    }
  );

  // RTK Query mutation for retry
  const [retryDeliveryMutation, { isLoading: isRetryPending }] = useRetryWebhookDeliveryMutation();

  const retryDelivery = useCallback(
    async (deliveryId: string) => {
      try {
        await retryDeliveryMutation({ deliveryId, webhookId }).unwrap();
        toast.success("Delivery queued for retry");
        refetchDeliveries();
      } catch (error: any) {
        toast.error(error.message || "Failed to retry delivery");
      }
    },
    [webhookId, retryDeliveryMutation, refetchDeliveries]
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

  // RTK Query for webhooks and event types
  const { data: webhooks, isLoading: isLoadingWebhooks, isError: isWebhooksError, refetch: refetchWebhooks } = useGetWebhooksQuery(undefined, {
    selectFromResult: ({ data, ...rest }) => ({ data: (data as any[] | undefined) ?? null, ...rest }),
  });
  const { data: eventTypes } = useGetWebhookEventTypesQuery(undefined, {
    selectFromResult: ({ data, ...rest }) => ({ data: (data as any[] | undefined) ?? null, ...rest }),
  });

  // RTK Query mutations
  const [createWebhookMutation, { isLoading: isCreatePending }] = useCreateWebhookMutation();
  const [deleteWebhookMutation, { isLoading: isDeletePending }] = useDeleteWebhookMutation();
  const [testWebhookMutation, { isLoading: isTestPending }] = useTestWebhookMutation();
  const [regenerateSecretMutation, { isLoading: isRegeneratePending }] = useRegenerateWebhookSecretMutation();

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
        await createWebhookMutation(data as any).unwrap();
        toast.success("Webhook created");
        setIsCreateOpen(false);
        form.reset();
      } catch (error: any) {
        toast.error(error?.data || error?.message || "Failed to create webhook");
      }
    },
    [createWebhookMutation, form]
  );

  const deleteWebhook = useCallback(
    async (id: string) => {
      try {
        await deleteWebhookMutation(id).unwrap();
        toast.success("Webhook deleted");
      } catch (error: any) {
        toast.error(error?.data || error?.message || "Failed to delete webhook");
      }
    },
    [deleteWebhookMutation]
  );

  const testWebhook = useCallback(async (id: string) => {
    try {
      const result = await testWebhookMutation(id).unwrap();
      if (result.success) {
        toast.success(`Test successful (${result.status})`);
      } else {
        toast.error(`Test failed: ${result.error || result.statusText}`);
      }
    } catch (error: any) {
      toast.error(error?.data || error?.message || "Failed to test webhook");
    }
  }, [testWebhookMutation]);

  const regenerateSecret = useCallback(
    async (id: string) => {
      try {
        await regenerateSecretMutation(id).unwrap();
        toast.success("Secret regenerated");
      } catch (error: any) {
        toast.error(error?.data || error?.message || "Failed to regenerate secret");
      }
    },
    [regenerateSecretMutation]
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
    (eventTypes ?? []).reduce<Record<string, any[]>>(
      (acc, event) => {
        const cat = event.category ?? "other";
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat].push(event);
        return acc;
      },
      {}
    );

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
  const reduxDispatch = useAppDispatch();
  const enterpriseTeamState = useAppSelector((state) => state.enterpriseTeam);

  // RTK Query for API keys
  const { data: apiKeysList, isLoading: isLoadingKeys, isError: isKeysError, refetch: refetchKeys } = useGetApiKeysQuery(undefined, {
    selectFromResult: ({ data, ...rest }) => ({ data: (data as any[] | undefined) ?? null, ...rest }),
  });

  // Sync RTK Query data into enterpriseTeam Redux slice
  const apiKeysRef = useRef(apiKeysList);
  if (apiKeysList !== apiKeysRef.current) {
    apiKeysRef.current = apiKeysList;
    if (apiKeysList) {
      reduxDispatch(setApiKeys(apiKeysList.map((k: any) => ({
        id: k.id,
        name: k.name,
        key: "",
        prefix: k.keyPrefix,
        permissions: [],
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt ?? null,
        createdAt: k.createdAt,
        createdBy: "",
      }))));
    }
  }
  if (isLoadingKeys !== enterpriseTeamState.apiKeysLoading) {
    reduxDispatch(setApiKeysLoading(isLoadingKeys));
  }
  if (isKeysError && !enterpriseTeamState.error) {
    reduxDispatch(setEnterpriseTeamError("Failed to load API keys"));
  }

  // RTK Query mutations
  const [createApiKeyMutation, { isLoading: isCreateKeyPending }] = useCreateApiKeyMutation();
  const [revokeApiKeyMutation, { isLoading: isRevokePending }] = useRevokeApiKeyMutation();

  // Rename and delete are not in RTK Query — use vanilla tRPC
  // isDeleteKeyPending and isRenamePendingRtk are provided by RTK Query mutations below

  const createKey = useCallback(
    async (name: string) => {
      try {
        const data = await createApiKeyMutation({ name }).unwrap();
        const d = data as any;
        setRevealedKey(d.key);
        reduxDispatch(addApiKey({
          id: d.id,
          name: d.name,
          key: d.key,
          prefix: d.keyPrefix,
          permissions: [],
          lastUsedAt: null,
          expiresAt: null,
          createdAt: d.createdAt,
          createdBy: "",
        }));
        setIsCreateOpen(false);
        setNewKeyName("Default");
        toast.success("API key created. Copy it now — it won't be shown again.");
      } catch (error: any) {
        toast.error(error?.data || error?.message || "Failed to create API key");
      }
    },
    [createApiKeyMutation, reduxDispatch]
  );

  const revokeKey = useCallback(
    async (id: string) => {
      try {
        await revokeApiKeyMutation(id).unwrap();
        toast.success("API key revoked");
      } catch (error: any) {
        toast.error(error?.data || error?.message || "Failed to revoke API key");
      }
    },
    [revokeApiKeyMutation]
  );

  const [deleteApiKeyMutation, { isLoading: isDeleteKeyPendingRtk }] = useDeleteApiKeyMutation();
  const [renameApiKeyMutation, { isLoading: isRenamePendingRtk }] = useRenameApiKeyMutation();

  const deleteKey = useCallback(
    async (id: string) => {
      try {
        await deleteApiKeyMutation({ id }).unwrap();
        reduxDispatch(removeApiKey(id));
        toast.success("API key deleted");
        refetchKeys();
      } catch (error: any) {
        toast.error(error?.message || "Failed to delete API key");
      }
    },
    [deleteApiKeyMutation, refetchKeys, reduxDispatch]
  );

  const renameKey = useCallback(
    async (id: string, name: string) => {
      try {
        await renameApiKeyMutation({ id, name }).unwrap();
        toast.success("API key renamed");
        refetchKeys();
        setEditingKeyId(null);
      } catch (error: any) {
        toast.error(error?.message || "Failed to rename API key");
      }
    },
    [renameApiKeyMutation, refetchKeys]
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
          onRetry={() => refetchKeys()}
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
                          disabled={isRenamePendingRtk}
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
