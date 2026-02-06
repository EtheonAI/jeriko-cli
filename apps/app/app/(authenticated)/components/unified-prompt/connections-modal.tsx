"use client";

import { useState, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { cn } from "@repo/design-system/lib/utils";
import {
  PlugIcon,
  AppWindowIcon,
  MonitorSmartphoneIcon,
  Loader2Icon,
  SearchIcon,
  CheckCircleIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useDevicesData } from "@/lib/store/hooks/useDevicesData";

// ============================================================================
// Types
// ============================================================================

export interface SelectedConnection {
  id: string;
  type: "app" | "device";
  name: string;
}

interface ConnectionsModalProps {
  disabled?: boolean;
  selectedConnections: SelectedConnection[];
  onToggleConnection: (connection: SelectedConnection) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ConnectionsModal({
  disabled,
  selectedConnections,
  onToggleConnection,
}: ConnectionsModalProps) {
  const [search, setSearch] = useState("");

  const { data: connectors, isLoading: loadingConnectors } = trpc.connectors.list.useQuery(
    undefined,
    { retry: 1, staleTime: 60_000 }
  );

  const { devices, isLoading: loadingDevices } = useDevicesData();

  const filteredConnectors = useMemo(() => {
    if (!connectors) return [];
    if (!search) return connectors;
    const lower = search.toLowerCase();
    return connectors.filter((item) => {
      const name = item.definition?.name ?? item.connector.id;
      return name.toLowerCase().includes(lower);
    });
  }, [connectors, search]);

  const filteredDevices = useMemo(() => {
    if (!devices || !Array.isArray(devices)) return [];
    if (!search) return devices as { id: string; name?: string; status?: string }[];
    const lower = search.toLowerCase();
    return (devices as { id: string; name?: string; status?: string }[]).filter((d) =>
      (d.name ?? d.id).toLowerCase().includes(lower)
    );
  }, [devices, search]);

  const connectorCount = connectors?.length ?? 0;
  const deviceCount = Array.isArray(devices) ? devices.length : 0;
  const selectedCount = selectedConnections.length;

  const isSelected = (id: string) => selectedConnections.some((c) => c.id === id);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 px-2 rounded-full text-xs gap-1",
            selectedCount > 0
              ? "text-primary bg-primary/10 hover:bg-primary/15"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          <PlugIcon className="size-3" />
          <span>Connections</span>
          {selectedCount > 0 && (
            <span className="size-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
              {selectedCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Connections</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search apps & devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 rounded-xl text-sm"
          />
        </div>

        <Tabs defaultValue="apps" className="w-full">
          <TabsList className="w-full h-9">
            <TabsTrigger value="apps" className="text-xs gap-1.5">
              <AppWindowIcon className="size-3" />
              Apps {connectorCount > 0 && `(${connectorCount})`}
            </TabsTrigger>
            <TabsTrigger value="devices" className="text-xs gap-1.5">
              <MonitorSmartphoneIcon className="size-3" />
              Devices {deviceCount > 0 && `(${deviceCount})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apps" className="mt-3 max-h-[300px] overflow-y-auto">
            {loadingConnectors ? (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredConnectors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search
                  ? "No apps match your search."
                  : "No connected apps. Go to Settings to add integrations."}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredConnectors.map((item) => {
                  const name = item.definition?.name ?? item.connector.id;
                  const selected = isSelected(item.connector.id);
                  return (
                    <button
                      key={item.connector.id}
                      type="button"
                      onClick={() =>
                        onToggleConnection({
                          id: item.connector.id,
                          type: "app",
                          name,
                        })
                      }
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-colors",
                        selected ? "bg-primary/10" : "hover:bg-accent"
                      )}
                    >
                      <AppWindowIcon className="size-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-left truncate">{name}</span>
                      {item.connector.status === "connected" && (
                        <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
                      )}
                      {selected && <CheckCircleIcon className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="devices" className="mt-3 max-h-[300px] overflow-y-auto">
            {loadingDevices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {search
                  ? "No devices match your search."
                  : "No devices registered. Go to Settings to add devices."}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredDevices.map((device) => {
                  const name = device.name ?? device.id;
                  const selected = isSelected(device.id);
                  return (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() =>
                        onToggleConnection({
                          id: device.id,
                          type: "device",
                          name,
                        })
                      }
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-colors",
                        selected ? "bg-primary/10" : "hover:bg-accent"
                      )}
                    >
                      <MonitorSmartphoneIcon className="size-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-left truncate">{name}</span>
                      {device.status === "online" && (
                        <span className="size-1.5 rounded-full bg-green-500 shrink-0" />
                      )}
                      {selected && <CheckCircleIcon className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
