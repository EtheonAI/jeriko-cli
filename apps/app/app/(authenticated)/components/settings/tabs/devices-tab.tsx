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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
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
  PlusIcon,
  MonitorIcon,
  SmartphoneIcon,
  GlobeIcon,
  ServerIcon,
  WifiIcon,
  WifiOffIcon,
  TrashIcon,
  RefreshCwIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { useDevicesData } from "@/lib/store/hooks/useDevicesData";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ErrorState } from "./error-state";

// Device type icons
const deviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  browser: GlobeIcon,
  desktop: MonitorIcon,
  mobile: SmartphoneIcon,
  server: ServerIcon,
};

// Status config
const statusConfig: Record<
  string,
  { color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  online: { color: "text-green-500", icon: WifiIcon },
  offline: { color: "text-muted-foreground", icon: WifiOffIcon },
  busy: { color: "text-amber-500", icon: WifiIcon },
  error: { color: "text-destructive", icon: WifiOffIcon },
};

const registerDeviceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: z.enum(["browser", "desktop", "mobile", "server"]),
  platform: z.string().optional(),
});

type RegisterDeviceForm = z.infer<typeof registerDeviceSchema>;

export function DevicesTab() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Fetch devices
  const { devices, isLoading, error, refetch } = useDevicesData();
  const isError = !!error;

  // Form
  const form = useForm<RegisterDeviceForm>({
    resolver: zodResolver(registerDeviceSchema),
    defaultValues: {
      name: "",
      type: "desktop",
      platform: "",
    },
  });

  const onSubmit = (data: RegisterDeviceForm) => {
    getTrpcClient()
      .devices.register.mutate(data)
      .then(() => {
        toast.success("Device registered successfully");
        refetch();
        setIsRegisterOpen(false);
        form.reset();
      })
      .catch((error: any) => {
        toast.error(error?.message || "Failed to register device");
      });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Devices</h2>
            <p className="text-sm text-muted-foreground">Manage your connected devices.</p>
          </div>
        </div>
        <Separator />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Devices</h2>
            <p className="text-sm text-muted-foreground">Manage your connected devices.</p>
          </div>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load devices"
          message="Unable to load your devices. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Devices</h2>
          <p className="text-sm text-muted-foreground">
            Manage devices that Rubic can control and interact with.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCwIcon className="h-4 w-4" />
            Refresh
          </Button>

          <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <PlusIcon className="h-4 w-4" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Register New Device</DialogTitle>
                <DialogDescription>
                  Add a new device for Rubic to control. You&apos;ll need to install the Rubic agent
                  on the device.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name</Label>
                  <Input id="name" {...form.register("name")} placeholder="My MacBook Pro" />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Device Type</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(value) =>
                      form.setValue("type", value as RegisterDeviceForm["type"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desktop">
                        <div className="flex items-center gap-2">
                          <MonitorIcon className="h-4 w-4" />
                          Desktop Computer
                        </div>
                      </SelectItem>
                      <SelectItem value="browser">
                        <div className="flex items-center gap-2">
                          <GlobeIcon className="h-4 w-4" />
                          Web Browser
                        </div>
                      </SelectItem>
                      <SelectItem value="mobile">
                        <div className="flex items-center gap-2">
                          <SmartphoneIcon className="h-4 w-4" />
                          Mobile Device
                        </div>
                      </SelectItem>
                      <SelectItem value="server">
                        <div className="flex items-center gap-2">
                          <ServerIcon className="h-4 w-4" />
                          Server
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="platform">Platform (optional)</Label>
                  <Input
                    id="platform"
                    {...form.register("platform")}
                    placeholder="macOS, Windows, Linux..."
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Register Device</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {/* Device List */}
      {devices && devices.length > 0 ? (
        <div className="space-y-3">
          {devices.map((device) => {
            const DeviceIcon = deviceIcons[device.type] || MonitorIcon;
            const status = statusConfig[device.status] || statusConfig.offline;
            const StatusIcon = status.icon;

            return (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <DeviceIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{device.name}</span>
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <Badge
                        variant={device.status === "online" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {device.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{device.type}</span>
                      {device.platform && (
                        <>
                          <span>•</span>
                          <span>{device.platform}</span>
                        </>
                      )}
                      {device.lastHeartbeat && (
                        <>
                          <span>•</span>
                          <span>
                            Last seen{" "}
                            {formatDistanceToNow(new Date(device.lastHeartbeat), {
                              addSuffix: true,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    {device.capabilities && device.capabilities.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {device.capabilities.slice(0, 3).map((cap) => (
                          <Badge key={cap} variant="outline" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                        {device.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{device.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                        <AlertDialogTitle>Remove device?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will unregister &quot;{device.name}&quot; from your account. Any
                          active sessions will be terminated.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            getTrpcClient()
                              .devices.unregister.mutate({ id: device.id })
                              .then(() => {
                                toast.success("Device removed");
                                refetch();
                              })
                              .catch((error: any) => {
                                toast.error(error?.message || "Failed to remove device");
                              });
                          }}
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
      ) : (
        <div className="rounded-lg border p-8 text-center">
          <MonitorIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No devices registered</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Register a device to allow Rubic to control your computer, browser, or server.
          </p>
          <Button onClick={() => setIsRegisterOpen(true)} className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Register your first device
          </Button>
        </div>
      )}

      <Separator />

      {/* Installation Instructions */}
      <div className="rounded-lg border p-4 bg-muted/30">
        <h4 className="text-sm font-medium mb-2">Installing the Rubic Agent</h4>
        <p className="text-xs text-muted-foreground mb-3">
          To control a device, you need to install the Rubic agent on it. The agent securely
          connects to Rubic and executes commands on your behalf.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              macOS / Linux
            </Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              curl -sSL https://rubic.dev/install.sh | sh
            </code>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Windows
            </Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              irm https://rubic.dev/install.ps1 | iex
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
