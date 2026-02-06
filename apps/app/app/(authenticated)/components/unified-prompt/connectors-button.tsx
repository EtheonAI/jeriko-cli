"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { PlugIcon, AppWindowIcon, MonitorSmartphoneIcon, Loader2Icon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useDevicesData } from "@/lib/store/hooks/useDevicesData";

interface ConnectorsButtonProps {
  disabled?: boolean;
}

export function ConnectorsButton({ disabled }: ConnectorsButtonProps) {
  const { data: connectors, isLoading: loadingConnectors } = trpc.connectors.list.useQuery(
    undefined,
    {
      retry: 1,
      staleTime: 60_000,
    }
  );

  const { devices, isLoading: loadingDevices } = useDevicesData();

  const connectorCount = connectors?.length ?? 0;
  const deviceCount = Array.isArray(devices) ? devices.length : 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 px-2 rounded-full text-xs text-muted-foreground hover:bg-accent gap-1"
        >
          <PlugIcon className="size-3" />
          <span>Connectors</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-0">
        <Tabs defaultValue="apps" className="w-full">
          <TabsList className="w-full rounded-t-2xl rounded-b-none border-b h-9">
            <TabsTrigger value="apps" className="text-xs gap-1.5">
              <AppWindowIcon className="size-3" />
              Apps {connectorCount > 0 && `(${connectorCount})`}
            </TabsTrigger>
            <TabsTrigger value="devices" className="text-xs gap-1.5">
              <MonitorSmartphoneIcon className="size-3" />
              Devices {deviceCount > 0 && `(${deviceCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apps" className="p-3 mt-0">
            {loadingConnectors ? (
              <div className="flex items-center justify-center py-4">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : connectorCount === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No connected apps. Go to Settings to add integrations.
              </p>
            ) : (
              <div className="space-y-1.5">
                {connectors?.map((item) => (
                  <div
                    key={item.connector.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-xs"
                  >
                    <AppWindowIcon className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{item.definition?.name ?? item.connector.id}</span>
                    {item.connector.status === "connected" && (
                      <span className="size-1.5 rounded-full bg-green-500 ml-auto shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="devices" className="p-3 mt-0">
            {loadingDevices ? (
              <div className="flex items-center justify-center py-4">
                <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : deviceCount === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No devices registered. Go to Settings to add devices.
              </p>
            ) : (
              <div className="space-y-1.5">
                {(devices as { id: string; name?: string; status?: string }[])?.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-xs"
                  >
                    <MonitorSmartphoneIcon className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{device.name ?? device.id}</span>
                    {device.status === "online" && (
                      <span className="size-1.5 rounded-full bg-green-500 ml-auto shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
