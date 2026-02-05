"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@repo/design-system/components/ui/sheet";
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
  RefreshCwIcon,
  UnlinkIcon,
  TrashIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { AppStatusBadge } from "./app-status-badge";

interface AppConfigPanelProps {
  connectorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: (definitionId: string, type: string) => void;
}

export function AppConfigPanel({
  connectorId,
  open,
  onOpenChange,
  onReconnect,
}: AppConfigPanelProps) {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.connectors.get.useQuery(
    { id: connectorId! },
    { enabled: !!connectorId && open }
  );

  const { data: syncHistory } = trpc.connectors.getSyncHistory.useQuery(
    { connectorId: connectorId!, limit: 5 },
    { enabled: !!connectorId && open }
  );

  const updateConfig = trpc.connectors.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Settings updated");
      utils.connectors.get.invalidate({ id: connectorId! });
      utils.connectors.list.invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to update settings"),
  });

  const syncConnector = trpc.connectors.sync.useMutation({
    onSuccess: () => {
      toast.success("Sync started");
      utils.connectors.get.invalidate({ id: connectorId! });
      utils.connectors.list.invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to start sync"),
  });

  const disconnectConnector = trpc.connectors.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Disconnected");
      utils.connectors.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || "Failed to disconnect"),
  });

  const uninstallConnector = trpc.connectors.uninstall.useMutation({
    onSuccess: () => {
      toast.success("Removed");
      utils.connectors.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || "Failed to remove"),
  });

  const connector = data?.connector;
  const definition = data?.definition;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        {isLoading || !connector || !definition ? (
          <SheetHeader>
            <SheetTitle>Loading...</SheetTitle>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {definition.name}
                <AppStatusBadge status={connector.status} />
              </SheetTitle>
              <SheetDescription>
                {definition.description || `Manage your ${definition.name} connection`}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-6 px-4">
              {/* Connection Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Connection</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <AppStatusBadge status={connector.status} showDot />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connected since</span>
                    <span>{format(new Date(connector.createdAt), "MMM d, yyyy")}</span>
                  </div>
                  {connector.lastSyncAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last synced</span>
                      <span>
                        {formatDistanceToNow(new Date(connector.lastSyncAt), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                  {connector.tokenExpiresAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Token expires</span>
                      <span>
                        {formatDistanceToNow(new Date(connector.tokenExpiresAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Sync Settings */}
              {connector.status === "connected" && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Sync Settings</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Auto-sync</p>
                        <p className="text-xs text-muted-foreground">
                          Automatically sync data on a schedule
                        </p>
                      </div>
                      <Switch
                        checked={connector.syncEnabled}
                        onCheckedChange={(checked) =>
                          updateConfig.mutate({ id: connector.id, syncEnabled: checked })
                        }
                      />
                    </div>
                    {connector.syncEnabled && (
                      <div className="space-y-1.5">
                        <p className="text-sm">Sync interval</p>
                        <Select
                          value={String(connector.syncInterval ?? 3600)}
                          onValueChange={(value) =>
                            updateConfig.mutate({ id: connector.id, syncInterval: Number(value) })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="900">Every 15 minutes</SelectItem>
                            <SelectItem value="3600">Every hour</SelectItem>
                            <SelectItem value="14400">Every 4 hours</SelectItem>
                            <SelectItem value="86400">Daily</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => syncConnector.mutate({ id: connector.id })}
                      disabled={syncConnector.isPending}
                    >
                      {syncConnector.isPending ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCwIcon className="h-4 w-4" />
                      )}
                      Sync now
                    </Button>
                  </div>

                  <Separator />
                </>
              )}

              {/* Sync History */}
              {syncHistory && syncHistory.length > 0 && (
                <>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Recent Syncs</h4>
                    <div className="space-y-2">
                      {syncHistory.map((log) => {
                        const icon =
                          log.status === "success" ? (
                            <CheckCircleIcon className="h-3.5 w-3.5 text-green-500" />
                          ) : log.status === "failed" ? (
                            <XCircleIcon className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          );

                        return (
                          <div key={log.id} className="flex items-center gap-2 text-xs">
                            {icon}
                            <span className="flex-1 text-muted-foreground">
                              {format(new Date(log.startedAt), "MMM d, h:mm a")}
                            </span>
                            {log.itemsSynced != null && log.itemsSynced > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                {log.itemsSynced} items
                              </Badge>
                            )}
                            <Badge
                              variant={
                                log.status === "success"
                                  ? "default"
                                  : log.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {log.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              {/* Error state with reconnect */}
              {connector.status === "error" && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                  <p className="text-sm font-medium text-destructive">Connection error</p>
                  <p className="text-xs text-muted-foreground">
                    {connector.lastSyncError ||
                      "The connection has expired or was revoked. Please reconnect."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => onReconnect(definition.id, definition.type)}
                  >
                    <LinkIcon className="h-4 w-4" />
                    Reconnect
                  </Button>
                </div>
              )}
            </div>

            <SheetFooter className="border-t">
              {connector.status === "connected" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <UnlinkIcon className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect {definition.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will revoke access. You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectConnector.mutate({ id: connector.id })}
                      >
                        {disconnectConnector.isPending && (
                          <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <TrashIcon className="h-4 w-4" />
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {definition.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove {definition.name} and all synced data from your
                      account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => uninstallConnector.mutate({ id: connector.id })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {uninstallConnector.isPending && (
                        <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
