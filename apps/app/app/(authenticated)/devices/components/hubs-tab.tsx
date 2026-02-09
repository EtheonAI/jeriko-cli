"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
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
  NetworkIcon,
  RefreshCwIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  PlugIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const addHubSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  url: z.string().url("Must be a valid URL"),
  accessToken: z.string().min(1, "Access token is required"),
});

type AddHubForm = z.infer<typeof addHubSchema>;

const statusBadge: Record<
  string,
  { variant: "default" | "secondary" | "destructive"; label: string }
> = {
  connected: { variant: "default", label: "Connected" },
  disconnected: { variant: "secondary", label: "Disconnected" },
  error: { variant: "destructive", label: "Error" },
};

export function HubsTab() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: hubs, isLoading } = trpc.smartHome.listHubs.useQuery();
  const utils = trpc.useUtils();

  const registerHub = trpc.smartHome.registerHub.useMutation({
    onSuccess: (hub) => {
      toast.success("Hub connected successfully");
      utils.smartHome.listHubs.invalidate();
      setIsAddOpen(false);
      form.reset();
      // Auto-discover entities after registration
      if (hub?.id) {
        discoverEntities.mutate({ hubId: hub.id });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to connect hub");
    },
  });

  const deleteHub = trpc.smartHome.deleteHub.useMutation({
    onSuccess: () => {
      toast.success("Hub removed");
      utils.smartHome.listHubs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove hub");
    },
  });

  const discoverEntities = trpc.smartHome.discoverEntities.useMutation({
    onSuccess: (data) => {
      toast.success(`Discovered ${data.entityCount} devices`);
      utils.smartHome.listHubs.invalidate();
      utils.smartHome.listEntities.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to sync devices");
    },
  });

  const testConnection = trpc.smartHome.testConnection.useMutation({
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(`Connection OK${data.version ? ` (HA ${data.version})` : ""}`);
      } else {
        toast.error("Connection failed. Check your Home Assistant URL and access token.");
      }
      utils.smartHome.listHubs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to test connection");
    },
  });

  const form = useForm<AddHubForm>({
    resolver: zodResolver(addHubSchema),
    defaultValues: {
      name: "",
      url: "",
      accessToken: "",
    },
  });

  const onSubmit = (data: AddHubForm) => {
    registerHub.mutate({
      name: data.name,
      config: {
        url: data.url,
        accessToken: data.accessToken,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-36 rounded-lg border animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Connect smart home hubs to control devices through Rubic.
        </p>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Add Hub
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Home Assistant</DialogTitle>
              <DialogDescription>
                Enter your Home Assistant URL and a long-lived access token. You can create a token
                in HA under Profile &gt; Security &gt; Long-Lived Access Tokens.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hub-name">Hub Name</Label>
                <Input id="hub-name" {...form.register("name")} placeholder="My Home" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hub-url">Home Assistant URL</Label>
                <Input
                  id="hub-url"
                  {...form.register("url")}
                  placeholder="http://homeassistant.local:8123"
                />
                {form.formState.errors.url && (
                  <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hub-token">Access Token</Label>
                <Input
                  id="hub-token"
                  type="password"
                  {...form.register("accessToken")}
                  placeholder="eyJ..."
                />
                {form.formState.errors.accessToken && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.accessToken.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={registerHub.isPending}>
                  {registerHub.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                  Connect
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {hubs && hubs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {hubs.map((hub) => {
            const badge = (statusBadge[hub.status] ?? statusBadge.disconnected)!;
            const StatusIcon =
              hub.status === "connected"
                ? CheckCircleIcon
                : hub.status === "error"
                  ? XCircleIcon
                  : AlertCircleIcon;

            return (
              <div key={hub.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <NetworkIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{hub.name}</span>
                        <Badge variant={badge.variant} className="text-xs">
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="capitalize">{hub.type.replace("_", " ")}</span>
                        {String((hub.metadata as Record<string, unknown>)?.haVersion ?? "") !==
                          "" && (
                          <>
                            <span>·</span>
                            <span>
                              v{String((hub.metadata as Record<string, unknown>)?.haVersion)}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span>{hub.entityCount} devices</span>
                        {hub.lastSyncAt && (
                          <>
                            <span>·</span>
                            <span>
                              Synced{" "}
                              {formatDistanceToNow(new Date(hub.lastSyncAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => testConnection.mutate({ hubId: hub.id })}
                    disabled={testConnection.isPending}
                  >
                    {testConnection.isPending ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlugIcon className="h-3.5 w-3.5" />
                    )}
                    Test
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => discoverEntities.mutate({ hubId: hub.id })}
                    disabled={discoverEntities.isPending}
                  >
                    {discoverEntities.isPending ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="h-3.5 w-3.5" />
                    )}
                    Sync Devices
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-muted-foreground hover:text-destructive"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove hub?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will disconnect &quot;{hub.name}&quot; and remove all cached device
                          data. Your Home Assistant instance will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteHub.mutate({ id: hub.id })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleteHub.isPending && (
                            <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                          )}
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
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <NetworkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No hubs connected</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Connect your Home Assistant hub to control smart home devices through Rubic.
          </p>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Connect your first hub
          </Button>
        </div>
      )}
    </div>
  );
}
