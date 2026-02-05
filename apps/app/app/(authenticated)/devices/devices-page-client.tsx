"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { MonitorIcon, HomeIcon, NetworkIcon, LayoutGridIcon } from "lucide-react";
import { MyDevicesTab } from "./components/my-devices-tab";
import { SmartHomeTab } from "./components/smart-home-tab";
import { HubsTab } from "./components/hubs-tab";
import { DeviceCatalogTab } from "./components/device-catalog-tab";

export function DevicesPageClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Devices</h1>
        <p className="text-muted-foreground">
          Manage devices and smart home integrations that Rubic can control.
        </p>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog" className="gap-2">
            <LayoutGridIcon className="h-4 w-4" />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="my-devices" className="gap-2">
            <MonitorIcon className="h-4 w-4" />
            My Devices
          </TabsTrigger>
          <TabsTrigger value="smart-home" className="gap-2">
            <HomeIcon className="h-4 w-4" />
            Smart Home
          </TabsTrigger>
          <TabsTrigger value="hubs" className="gap-2">
            <NetworkIcon className="h-4 w-4" />
            Hubs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <DeviceCatalogTab />
        </TabsContent>

        <TabsContent value="my-devices" className="space-y-6">
          <MyDevicesTab />

          {/* Agent Installation Instructions */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h4 className="text-sm font-medium mb-2">Installing the Rubic Agent</h4>
            <p className="text-xs text-muted-foreground mb-3">
              To control a device, install the Rubic agent on it. The agent securely connects to
              Rubic and executes commands on your behalf.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  macOS / Linux
                </Badge>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  curl -sSL https://rubic.dev/install.sh | sh
                </code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Windows
                </Badge>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  irm https://rubic.dev/install.ps1 | iex
                </code>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="smart-home">
          <SmartHomeTab />
        </TabsContent>

        <TabsContent value="hubs">
          <HubsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
