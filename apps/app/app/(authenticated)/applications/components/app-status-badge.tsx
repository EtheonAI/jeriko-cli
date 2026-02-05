"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  MinusCircleIcon,
} from "lucide-react";

const statusConfig = {
  connected: {
    label: "Connected",
    variant: "default" as const,
    icon: CheckCircle2Icon,
    dotColor: "bg-green-500",
  },
  disconnected: {
    label: "Disconnected",
    variant: "secondary" as const,
    icon: MinusCircleIcon,
    dotColor: "bg-gray-400",
  },
  error: {
    label: "Error",
    variant: "destructive" as const,
    icon: XCircleIcon,
    dotColor: "bg-red-500",
  },
  pending: {
    label: "Pending",
    variant: "outline" as const,
    icon: ClockIcon,
    dotColor: "bg-gray-400",
  },
  syncing: {
    label: "Syncing",
    variant: "secondary" as const,
    icon: RefreshCwIcon,
    dotColor: "bg-yellow-500",
  },
} as const;

type ConnectorStatus = keyof typeof statusConfig;

interface AppStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  showDot?: boolean;
}

export function AppStatusBadge({ status, showIcon = true, showDot = false }: AppStatusBadgeProps) {
  const config = statusConfig[status as ConnectorStatus] ?? statusConfig.disconnected;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1 text-xs">
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />}
      {showIcon && <Icon className={`h-3 w-3 ${status === "syncing" ? "animate-spin" : ""}`} />}
      {config.label}
    </Badge>
  );
}
