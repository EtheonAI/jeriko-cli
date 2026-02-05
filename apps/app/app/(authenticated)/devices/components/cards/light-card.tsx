"use client";

import { useState, useCallback } from "react";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Slider } from "@repo/design-system/components/ui/slider";
import { LightbulbIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { EntityCardProps } from "./entity-card";

export function LightCard({ hubId, entity }: EntityCardProps) {
  const isOn = entity.state === "on";
  const brightness = entity.attributes?.brightness as number | undefined;
  const brightnessPercent = brightness != null ? Math.round((brightness / 255) * 100) : undefined;
  const supportedModes = (entity.attributes?.supported_color_modes as string[]) || [];
  const hasColorTemp = supportedModes.includes("color_temp");

  const [optimisticOn, setOptimisticOn] = useState(isOn);
  const [optimisticBrightness, setOptimisticBrightness] = useState(brightnessPercent ?? 100);

  const utils = trpc.useUtils();

  const controlEntity = trpc.smartHome.controlEntity.useMutation({
    onSuccess: () => {
      utils.smartHome.listEntities.invalidate();
    },
    onError: (error) => {
      // Revert optimistic state
      setOptimisticOn(isOn);
      setOptimisticBrightness(brightnessPercent ?? 100);
      toast.error(error.message || "Failed to control light");
    },
  });

  const handleToggle = useCallback(
    (checked: boolean) => {
      setOptimisticOn(checked);
      controlEntity.mutate({
        hubId,
        entityId: entity.entityId,
        service: checked ? "turn_on" : "turn_off",
      });
    },
    [hubId, entity.entityId, controlEntity]
  );

  const handleBrightness = useCallback(
    (value: number[]) => {
      const pct = value[0]!;
      setOptimisticBrightness(pct);
      setOptimisticOn(pct > 0);
      controlEntity.mutate({
        hubId,
        entityId: entity.entityId,
        service: "turn_on",
        data: { brightness: Math.round((pct / 100) * 255) },
      });
    },
    [hubId, entity.entityId, controlEntity]
  );

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              optimisticOn ? "bg-yellow-100 text-yellow-600" : "bg-muted text-muted-foreground"
            }`}
          >
            <LightbulbIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{entity.name}</p>
            {entity.areaName && (
              <p className="text-xs text-muted-foreground mt-0.5">{entity.areaName}</p>
            )}
          </div>
        </div>
        <Switch
          checked={optimisticOn}
          onCheckedChange={handleToggle}
          disabled={controlEntity.isPending}
        />
      </div>

      {brightnessPercent != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Brightness</span>
            <span className="text-xs text-muted-foreground">{optimisticBrightness}%</span>
          </div>
          <Slider
            value={[optimisticBrightness]}
            min={0}
            max={100}
            step={5}
            onValueCommit={handleBrightness}
            disabled={controlEntity.isPending}
          />
        </div>
      )}
    </div>
  );
}
