"use client";

import { LightCard } from "./light-card";
import { SwitchCard } from "./switch-card";
import { ClimateCard } from "./climate-card";
import { SensorCard } from "./sensor-card";
import { GenericCard } from "./generic-card";

export interface EntityCardProps {
  hubId: string;
  entity: {
    id: string;
    entityId: string;
    domain: string;
    name: string;
    areaName?: string | null;
    state?: string | null;
    attributes?: Record<string, unknown> | null;
  };
}

export function EntityCard({ hubId, entity }: EntityCardProps) {
  switch (entity.domain) {
    case "light":
      return <LightCard hubId={hubId} entity={entity} />;
    case "switch":
    case "fan":
    case "vacuum":
    case "input_boolean":
    case "automation":
    case "siren":
    case "humidifier":
    case "cover":
      return <SwitchCard hubId={hubId} entity={entity} />;
    case "climate":
    case "water_heater":
      return <ClimateCard hubId={hubId} entity={entity} />;
    case "sensor":
    case "binary_sensor":
      return <SensorCard entity={entity} />;
    default:
      return <GenericCard entity={entity} />;
  }
}
