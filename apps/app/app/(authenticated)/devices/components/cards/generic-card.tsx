"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { CircuitBoardIcon } from "lucide-react";
import type { EntityCardProps } from "./entity-card";

export function GenericCard({ entity }: Pick<EntityCardProps, "entity">) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <CircuitBoardIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{entity.name}</p>
            {entity.areaName && (
              <p className="text-xs text-muted-foreground mt-0.5">{entity.areaName}</p>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {entity.state ?? "unknown"}
        </Badge>
      </div>
    </div>
  );
}
