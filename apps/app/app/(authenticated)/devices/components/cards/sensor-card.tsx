"use client";

import { ThermometerIcon, DropletIcon, ZapIcon, SunIcon, GaugeIcon } from "lucide-react";
import type { EntityCardProps } from "./entity-card";

const deviceClassIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  temperature: ThermometerIcon,
  humidity: DropletIcon,
  power: ZapIcon,
  energy: ZapIcon,
  illuminance: SunIcon,
  pressure: GaugeIcon,
};

export function SensorCard({ entity }: Pick<EntityCardProps, "entity">) {
  const unit = (entity.attributes?.unit_of_measurement as string) || "";
  const deviceClass = (entity.attributes?.device_class as string) || "";
  const Icon = deviceClassIcons[deviceClass] || GaugeIcon;

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{entity.name}</p>
            {entity.areaName && (
              <p className="text-xs text-muted-foreground mt-0.5">{entity.areaName}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{entity.state ?? "—"}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
