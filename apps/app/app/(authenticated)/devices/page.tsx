import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import {
  MonitorIcon,
  MonitorSmartphoneIcon,
  PlusIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";

export const metadata: Metadata = {
  title: "Devices | Rubic",
  description: "Manage your connected devices",
};

function DeviceCard({
  name,
  type,
  lastActive,
  isCurrent,
}: {
  name: string;
  type: "desktop" | "mobile" | "tablet";
  lastActive: string;
  isCurrent?: boolean;
}) {
  const Icon = type === "desktop" ? MonitorIcon : type === "mobile" ? SmartphoneIcon : TabletIcon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {name}
        </CardTitle>
        {isCurrent && (
          <Badge variant="secondary" className="text-xs">
            This device
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{lastActive}</p>
      </CardContent>
    </Card>
  );
}

export default async function DevicesPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  // In production, this would come from the user's session/device data
  const currentDevice = {
    name: "Chrome on macOS",
    type: "desktop" as const,
    lastActive: "Active now",
    isCurrent: true,
  };

  return (
    <>
      <Header
        title="Devices"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Devices</h1>
            <p className="text-muted-foreground">
              Manage devices connected to your account
            </p>
          </div>
          <Button className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Add device
          </Button>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Connected Devices</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <DeviceCard {...currentDevice} />
            </div>
          </div>

          <div className="rounded-lg border border-dashed p-8 text-center">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MonitorSmartphoneIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <h3 className="mt-4 font-semibold">Access Rubic on more devices</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Sign in on your phone, tablet, or other computers to access Rubic
              anywhere. Your tasks and history sync automatically.
            </p>
            <Button variant="outline" className="mt-4 gap-2">
              <PlusIcon className="h-4 w-4" />
              Add another device
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
