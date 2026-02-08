"use client";

import { useState, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import {
  HomeIcon,
  RefreshCwIcon,
  Loader2Icon,
  LightbulbIcon,
  ThermometerIcon,
  GaugeIcon,
  PowerIcon,
  FanIcon,
  LockIcon,
  CameraIcon,
  ShieldIcon,
  BlindsIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { RoomGroup } from "./room-group";

const domainFilters = [
  { value: "all", label: "All", icon: null },
  { value: "light", label: "Lights", icon: LightbulbIcon },
  { value: "climate", label: "Climate", icon: ThermometerIcon },
  { value: "sensor", label: "Sensors", icon: GaugeIcon },
  { value: "switch", label: "Switches", icon: PowerIcon },
  { value: "fan", label: "Fans", icon: FanIcon },
  { value: "lock", label: "Locks", icon: LockIcon },
  { value: "cover", label: "Covers", icon: BlindsIcon },
  { value: "camera", label: "Cameras", icon: CameraIcon },
  { value: "alarm_control_panel", label: "Security", icon: ShieldIcon },
] as const;

export function SmartHomeTab() {
  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const [domainFilter, setDomainFilter] = useState("all");

  const { data: hubs, isLoading: hubsLoading } = trpc.smartHome.listHubs.useQuery();

  // Auto-select first hub
  const activeHubId = selectedHubId || hubs?.[0]?.id || "";

  const {
    data: entities,
    isLoading: entitiesLoading,
    refetch,
  } = trpc.smartHome.listEntities.useQuery(
    { hubId: activeHubId, domain: domainFilter === "all" ? undefined : domainFilter },
    { enabled: !!activeHubId }
  );

  const discoverEntities = trpc.smartHome.discoverEntities.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Group entities by room
  const roomGroups = useMemo(() => {
    if (!entities) return [];

    const groups = new Map<string, typeof entities>();
    for (const entity of entities) {
      const room = entity.areaName || "Unassigned";
      if (!groups.has(room)) {
        groups.set(room, []);
      }
      groups.get(room)!.push(entity);
    }

    // Sort: named rooms first (alphabetical), "Unassigned" last
    return Array.from(groups.entries()).toSorted(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [entities]);

  if (hubsLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  if (!hubs || hubs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <HomeIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No hub connected</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Connect a Home Assistant hub in the Hubs tab to see and control your smart home devices.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {hubs.length > 1 && (
            <Select value={activeHubId} onValueChange={setSelectedHubId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select hub" />
              </SelectTrigger>
              <SelectContent>
                {hubs.map((hub) => (
                  <SelectItem key={hub.id} value={hub.id}>
                    {hub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <ToggleGroup
            type="single"
            value={domainFilter}
            onValueChange={(v) => v && setDomainFilter(v)}
          >
            {domainFilters.map((f) => (
              <ToggleGroupItem key={f.value} value={f.value} size="sm" className="text-xs gap-1">
                {f.icon && <f.icon className="h-3.5 w-3.5" />}
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => refetch()}
          disabled={entitiesLoading}
        >
          {entitiesLoading ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Entity groups */}
      {entitiesLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 rounded-lg border animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : roomGroups.length > 0 ? (
        <div className="space-y-6">
          {roomGroups.map(([room, roomEntities]) => (
            <RoomGroup key={room} hubId={activeHubId} name={room} entities={roomEntities} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No devices found. Try syncing your hub.
          </p>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => discoverEntities.mutate({ hubId: activeHubId })}
            disabled={discoverEntities.isPending}
          >
            {discoverEntities.isPending ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
            Sync Devices
          </Button>
        </div>
      )}
    </div>
  );
}
