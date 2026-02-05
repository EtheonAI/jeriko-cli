"use client";

import { useState } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { EntityCard } from "./cards/entity-card";

interface RoomGroupProps {
  hubId: string;
  name: string;
  entities: Array<{
    id: string;
    entityId: string;
    domain: string;
    name: string;
    areaName?: string | null;
    state?: string | null;
    attributes?: Record<string, unknown> | null;
  }>;
}

export function RoomGroup({ hubId, name, entities }: RoomGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-3">
      <Button
        variant="ghost"
        className="gap-2 px-0 hover:bg-transparent h-auto"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronRightIcon className="h-4 w-4" />
        )}
        <span className="font-medium">{name}</span>
        <Badge variant="secondary" className="text-xs">
          {entities.length}
        </Badge>
      </Button>

      {isOpen && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => (
            <EntityCard key={entity.id} hubId={hubId} entity={entity} />
          ))}
        </div>
      )}
    </div>
  );
}
