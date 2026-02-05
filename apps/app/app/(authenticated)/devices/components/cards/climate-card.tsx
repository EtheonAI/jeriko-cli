"use client";

import { useState, useCallback } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@repo/design-system/components/ui/toggle-group";
import { ThermometerIcon, MinusIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { EntityCardProps } from "./entity-card";

const hvacModes = [
  { value: "heat", label: "Heat" },
  { value: "cool", label: "Cool" },
  { value: "auto", label: "Auto" },
  { value: "off", label: "Off" },
];

export function ClimateCard({ hubId, entity }: EntityCardProps) {
  const currentTemp = entity.attributes?.current_temperature as number | undefined;
  const targetTemp = entity.attributes?.temperature as number | undefined;
  const hvacMode = entity.state || "off";
  const unit = (entity.attributes?.temperature_unit as string) || "°F";

  const [optimisticTarget, setOptimisticTarget] = useState(targetTemp ?? 72);
  const [optimisticMode, setOptimisticMode] = useState(hvacMode);

  const utils = trpc.useUtils();

  const controlEntity = trpc.smartHome.controlEntity.useMutation({
    onSuccess: () => {
      utils.smartHome.listEntities.invalidate();
    },
    onError: (error) => {
      setOptimisticTarget(targetTemp ?? 72);
      setOptimisticMode(hvacMode);
      toast.error(error.message || "Failed to control thermostat");
    },
  });

  const adjustTemp = useCallback(
    (delta: number) => {
      const newTemp = optimisticTarget + delta;
      setOptimisticTarget(newTemp);
      controlEntity.mutate({
        hubId,
        entityId: entity.entityId,
        service: "set_temperature",
        data: { temperature: newTemp },
      });
    },
    [hubId, entity.entityId, optimisticTarget, controlEntity]
  );

  const changeMode = useCallback(
    (mode: string) => {
      if (!mode) return;
      setOptimisticMode(mode);
      controlEntity.mutate({
        hubId,
        entityId: entity.entityId,
        service: "set_hvac_mode",
        data: { hvac_mode: mode },
      });
    },
    [hubId, entity.entityId, controlEntity]
  );

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <ThermometerIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{entity.name}</p>
            {entity.areaName && (
              <p className="text-xs text-muted-foreground mt-0.5">{entity.areaName}</p>
            )}
          </div>
        </div>
        {currentTemp != null && (
          <span className="text-lg font-semibold tabular-nums">
            {currentTemp}
            {unit}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Target</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => adjustTemp(-1)}
            disabled={controlEntity.isPending}
          >
            <MinusIcon className="h-3 w-3" />
          </Button>
          <span className="text-sm font-medium tabular-nums w-12 text-center">
            {optimisticTarget}
            {unit}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => adjustTemp(1)}
            disabled={controlEntity.isPending}
          >
            <PlusIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ToggleGroup
        type="single"
        value={optimisticMode}
        onValueChange={changeMode}
        className="justify-start"
      >
        {hvacModes.map((mode) => (
          <ToggleGroupItem
            key={mode.value}
            value={mode.value}
            size="sm"
            className="text-xs"
            disabled={controlEntity.isPending}
          >
            {mode.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
