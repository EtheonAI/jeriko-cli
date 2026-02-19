"use client";

import { Label } from "@repo/design-system/components/ui/label";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { AlertCircleIcon, ExternalLinkIcon } from "lucide-react";
import {
  useGetScheduledTaskTriggerTypesQuery,
  useGetScheduledTaskTriggerConfigQuery,
} from "@/lib/store/api/api.slice";
import Link from "next/link";

interface TriggerType {
  slug: string;
  appName: string;
  description: string;
  configSchema?: Record<string, unknown>;
  payloadSchema?: Record<string, unknown>;
}

interface TriggerConfig {
  slug: string;
  appName: string;
  description: string;
  configSchema: Record<string, unknown>;
  payloadSchema: Record<string, unknown>;
}

interface TriggerSelectorProps {
  selectedApp: string;
  selectedEvent: string;
  triggerConfig: Record<string, unknown>;
  onAppChange: (app: string) => void;
  onEventChange: (event: string) => void;
  onConfigChange: (config: Record<string, unknown>) => void;
}

export function TriggerSelector({
  selectedApp,
  selectedEvent,
  triggerConfig,
  onAppChange,
  onEventChange,
  onConfigChange,
}: TriggerSelectorProps) {
  // Fetch available trigger types via RTK Query
  const {
    data: triggerTypesData,
    isLoading: isLoadingTypes,
    error: triggerTypesError,
  } = useGetScheduledTaskTriggerTypesQuery();
  const triggerTypes = ((triggerTypesData as any)?.triggers ?? []) as TriggerType[];
  const error = triggerTypesError
    ? (typeof triggerTypesError === "object" && "data" in triggerTypesError ? String((triggerTypesError as any).data) : "Failed to load trigger types")
    : null;

  // Fetch config schema when event is selected via RTK Query
  const {
    data: eventConfigData,
    isLoading: isLoadingConfig,
  } = useGetScheduledTaskTriggerConfigQuery(selectedEvent, { skip: !selectedEvent });
  const eventConfig = (selectedEvent ? eventConfigData : null) as TriggerConfig | null;

  // Group triggers by app name
  const appNames = [...new Set(triggerTypes.map((t) => t.appName))].sort();
  const eventsForApp = triggerTypes.filter((t) => t.appName === selectedApp);

  // Render dynamic config fields from JSON schema
  function renderConfigFields() {
    if (!eventConfig?.configSchema) return null;

    const schema = eventConfig.configSchema as {
      properties?: Record<string, { type?: string; description?: string; default?: unknown }>;
      required?: string[];
    };
    const properties = schema.properties;
    if (!properties) return null;

    const required = new Set(schema.required ?? []);

    return Object.entries(properties).map(([key, prop]) => (
      <div key={key} className="space-y-1">
        <Label htmlFor={`trigger-config-${key}`} className="text-sm">
          {key}
          {required.has(key) && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={`trigger-config-${key}`}
          placeholder={prop.description || key}
          value={String(triggerConfig[key] ?? prop.default ?? "")}
          onChange={(e) =>
            onConfigChange({ ...triggerConfig, [key]: e.target.value })
          }
        />
        {prop.description && (
          <p className="text-xs text-muted-foreground">{prop.description}</p>
        )}
      </div>
    ));
  }

  if (isLoadingTypes) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircleIcon className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (triggerTypes.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center space-y-2">
        <AlertCircleIcon className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">No connected apps</p>
        <p className="text-xs text-muted-foreground">
          Connect an app first to use event triggers.
        </p>
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Go to Applications
          <ExternalLinkIcon className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* App selector */}
      <div className="space-y-2">
        <Label>App</Label>
        <Select
          value={selectedApp}
          onValueChange={(value) => {
            onAppChange(value);
            onEventChange("");
            onConfigChange({});
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an app" />
          </SelectTrigger>
          <SelectContent>
            {appNames.map((app) => (
              <SelectItem key={app} value={app}>
                {app.charAt(0).toUpperCase() + app.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Event selector */}
      {selectedApp && (
        <div className="space-y-2">
          <Label>Event</Label>
          <Select
            value={selectedEvent}
            onValueChange={(value) => {
              onEventChange(value);
              onConfigChange({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a trigger event" />
            </SelectTrigger>
            <SelectContent>
              {eventsForApp.map((trigger) => (
                <SelectItem key={trigger.slug} value={trigger.slug}>
                  <div className="flex flex-col">
                    <span>{trigger.slug}</span>
                    {trigger.description && (
                      <span className="text-xs text-muted-foreground">
                        {trigger.description}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Dynamic config fields */}
      {selectedEvent && isLoadingConfig && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {selectedEvent && !isLoadingConfig && eventConfig?.configSchema && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Configuration</Label>
          {renderConfigFields()}
        </div>
      )}
    </div>
  );
}
