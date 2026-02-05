"use client";

import { useState, useCallback } from "react";
import { Switch } from "@repo/design-system/components/ui/switch";
import { PowerIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import type { EntityCardProps } from "./entity-card";

export function SwitchCard({ hubId, entity }: EntityCardProps) {
  const isOn = entity.state === "on";
  const powerW = entity.attributes?.current_power_w as number | undefined;

  const [optimisticOn, setOptimisticOn] = useState(isOn);

  const utils = trpc.useUtils();

  const controlEntity = trpc.smartHome.controlEntity.useMutation({
    onSuccess: () => {
      utils.smartHome.listEntities.invalidate();
    },
    onError: (error) => {
      setOptimisticOn(isOn);
      toast.error(error.message || "Failed to control switch");
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

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              optimisticOn ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
            }`}
          >
            <PowerIcon className="h-4 w-4" />
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

      {powerW != null && <p className="text-xs text-muted-foreground">{powerW}W</p>}
    </div>
  );
}
