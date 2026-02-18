"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
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
  LinkIcon,
  UnlinkIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  GithubIcon,
  MailIcon,
  MessageSquareIcon,
  FolderIcon,
  FileTextIcon,
  CalendarIcon,
} from "lucide-react";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { toast } from "sonner";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

// Icon mapping for connector types
const connectorIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  github: GithubIcon,
  google_drive: FolderIcon,
  google_calendar: CalendarIcon,
  gmail: MailIcon,
  slack: MessageSquareIcon,
  notion: FileTextIcon,
  default: LinkIcon,
};

// Status badge variants
const statusVariants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }> = {
  connected: { variant: "default", icon: CheckCircle2Icon },
  disconnected: { variant: "secondary", icon: XCircleIcon },
  pending: { variant: "outline", icon: ClockIcon },
  syncing: { variant: "secondary", icon: RefreshCwIcon },
  error: { variant: "destructive", icon: XCircleIcon },
};

export function ConnectorsTab() {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  // Query state
  const [definitions, setDefinitions] = useState<Awaited<ReturnType<ReturnType<typeof getTrpcClient>["connectors"]["listDefinitions"]["query"]>> | undefined>(undefined);
  const [installedConnectors, setInstalledConnectors] = useState<Awaited<ReturnType<ReturnType<typeof getTrpcClient>["connectors"]["list"]["query"]>> | undefined>(undefined);
  const [isLoadingDefinitions, setIsLoadingDefinitions] = useState(true);
  const [isLoadingInstalled, setIsLoadingInstalled] = useState(true);
  const [isDefinitionsError, setIsDefinitionsError] = useState(false);
  const [isInstalledError, setIsInstalledError] = useState(false);

  // Mutation pending states
  const [isInstallPending, setIsInstallPending] = useState(false);
  const [isDisconnectPending, setIsDisconnectPending] = useState(false);
  const [isUninstallPending, setIsUninstallPending] = useState(false);
  const [isSyncPending, setIsSyncPending] = useState(false);

  // Fetch definitions
  const fetchDefinitions = useCallback(async () => {
    setIsLoadingDefinitions(true);
    setIsDefinitionsError(false);
    try {
      const data = await getTrpcClient().connectors.listDefinitions.query();
      setDefinitions(data);
    } catch {
      setIsDefinitionsError(true);
    } finally {
      setIsLoadingDefinitions(false);
    }
  }, []);

  // Fetch installed connectors
  const fetchInstalled = useCallback(async () => {
    setIsLoadingInstalled(true);
    setIsInstalledError(false);
    try {
      const data = await getTrpcClient().connectors.list.query();
      setInstalledConnectors(data);
    } catch {
      setIsInstalledError(true);
    } finally {
      setIsLoadingInstalled(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchDefinitions();
    fetchInstalled();
  }, [fetchDefinitions, fetchInstalled]);

  // Mutation callbacks
  const installConnector = useCallback(async (input: { connectorDefinitionId: string }) => {
    setIsInstallPending(true);
    try {
      const data = await getTrpcClient().connectors.install.mutate(input);
      toast.success("Connector added. Click Connect to authorize.");
      await fetchInstalled();
      // Redirect to OAuth flow
      // window.location.href = `/api/connectors/${data.id}/oauth/start`;
    } catch (error: any) {
      toast.error(error.message || "Failed to install connector");
    } finally {
      setIsInstallPending(false);
    }
  }, [fetchInstalled]);

  const disconnectConnector = useCallback(async (input: { id: string }) => {
    setIsDisconnectPending(true);
    try {
      await getTrpcClient().connectors.disconnect.mutate(input);
      toast.success("Connector disconnected");
      await fetchInstalled();
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect connector");
    } finally {
      setIsDisconnectPending(false);
    }
  }, [fetchInstalled]);

  const uninstallConnector = useCallback(async (input: { id: string }) => {
    setIsUninstallPending(true);
    try {
      await getTrpcClient().connectors.uninstall.mutate(input);
      toast.success("Connector removed");
      await fetchInstalled();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove connector");
    } finally {
      setIsUninstallPending(false);
    }
  }, [fetchInstalled]);

  const syncConnector = useCallback(async (input: { id: string }) => {
    setIsSyncPending(true);
    try {
      await getTrpcClient().connectors.sync.mutate(input);
      toast.success("Sync started");
      await fetchInstalled();
    } catch (error: any) {
      toast.error(error.message || "Failed to start sync");
    } finally {
      setIsSyncPending(false);
    }
  }, [fetchInstalled]);

  const isLoading = isLoadingDefinitions || isLoadingInstalled;
  const isError = isDefinitionsError || isInstalledError;

  // Group installed connectors by ID for quick lookup
  const installedMap = new Map(
    installedConnectors?.map((c) => [c.definition.id, c]) || []
  );

  // Group definitions by category
  const groupedDefinitions = definitions?.reduce((acc, def) => {
    const category = def.category || "other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(def);
    return acc;
  }, {} as Record<string, typeof definitions>) || {};

  const categoryLabels: Record<string, string> = {
    communication: "Communication",
    storage: "Storage",
    productivity: "Productivity",
    development: "Development",
    crm: "CRM",
    analytics: "Analytics",
    other: "Other",
  };

  const handleConnect = (definitionId: string) => {
    const installed = installedMap.get(definitionId);
    if (installed) {
      // Already installed, start OAuth flow
      window.location.href = `/api/connectors/${installed.connector.id}/oauth/start`;
    } else {
      // Install first
      installConnector({ connectorDefinitionId: definitionId });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Connectors</h2>
          <p className="text-sm text-muted-foreground">
            Connect your favorite services to Rubic.
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
          <h2 className="text-lg font-semibold">Connectors</h2>
          <p className="text-sm text-muted-foreground">
            Connect your favorite services to Rubic.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load connectors"
          message="Unable to load your connectors. Please try again."
          onRetry={() => {
            fetchDefinitions();
            fetchInstalled();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Connectors</h2>
        <p className="text-sm text-muted-foreground">
          Connect your favorite services to Rubic for enhanced AI capabilities.
        </p>
      </div>

      <Separator />

      {/* Connected Services */}
      {installedConnectors && installedConnectors.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Connected Services</h3>

          <div className="space-y-3">
            {installedConnectors.map(({ connector, definition }) => {
              const Icon = connectorIcons[definition.type] ?? connectorIcons.default ?? LinkIcon;
              const status = (statusVariants[connector.status] ?? statusVariants.disconnected)!;
              const StatusIcon = status.icon;

              return (
                <div
                  key={connector.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{definition.name}</span>
                        <Badge variant={status.variant} className="gap-1 text-xs">
                          <StatusIcon className={`h-3 w-3 ${connector.status === "syncing" ? "animate-spin" : ""}`} />
                          {connector.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {connector.lastSyncAt
                          ? `Last synced ${format(new Date(connector.lastSyncAt), "MMM d, h:mm a")}`
                          : "Never synced"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connector.status === "connected" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => syncConnector({ id: connector.id })}
                        disabled={isSyncPending}
                      >
                        {isSyncPending && selectedConnector === connector.id ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCwIcon className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    {connector.status === "connected" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <UnlinkIcon className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disconnect {definition.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revoke access to {definition.name}. You can reconnect at any time.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => disconnectConnector({ id: connector.id })}
                            >
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(definition.id)}
                      >
                        Connect
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {definition.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove {definition.name} from your account. All synced data will be deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => uninstallConnector({ id: connector.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {installedConnectors && installedConnectors.length > 0 && <Separator />}

      {/* Available Connectors */}
      <div className="space-y-6">
        <h3 className="text-sm font-medium">Available Connectors</h3>

        {Object.entries(groupedDefinitions).map(([category, defs]) => {
          // Filter out already installed connectors
          const availableDefs = defs.filter((d) => !installedMap.has(d.id));
          if (availableDefs.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {categoryLabels[category] || category}
              </h4>

              <div className="grid gap-3 md:grid-cols-2">
                {availableDefs.map((definition) => {
                  const Icon = connectorIcons[definition.type] ?? connectorIcons.default ?? LinkIcon;

                  return (
                    <Card key={definition.id} className="flex items-center p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mr-4">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{definition.name}</span>
                          {definition.isPremium && (
                            <Badge variant="secondary" className="text-xs">
                              Pro
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {definition.description || `Connect to ${definition.name}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-4"
                        onClick={() => handleConnect(definition.id)}
                        disabled={isInstallPending}
                      >
                        {isInstallPending && selectedConnector === definition.id ? (
                          <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <LinkIcon className="h-4 w-4 mr-2" />
                        )}
                        Connect
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {definitions?.length === 0 && (
          <div className="rounded-lg border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No connectors available yet. Check back soon!
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* OAuth Info */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-2">About Connectors</h4>
        <p className="text-xs text-muted-foreground">
          Connectors allow Rubic to securely access your data from third-party services.
          We use OAuth 2.0 for authentication, which means we never see your passwords.
          You can disconnect any connector at any time, and we&apos;ll immediately revoke access.
        </p>
      </div>
    </div>
  );
}
