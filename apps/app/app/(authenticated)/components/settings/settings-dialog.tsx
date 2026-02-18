"use client";

import { Dialog, DialogContent, DialogTitle } from "@repo/design-system/components/ui/dialog";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { useSettings } from "./settings-context";
import { SettingsContent } from "./settings-content";
import { SettingsNav } from "./settings-nav";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { useEffect, useRef } from "react";

type SettingsDialogProps = {
  user?: {
    name: string | null;
    email: string;
    image: string | null;
  };
  isPro?: boolean;
};

export function SettingsDialog({ user, isPro = false }: SettingsDialogProps) {
  const { isOpen, closeSettings } = useSettings();
  const hasPrefetched = useRef(false);

  // Only prefetch settings data when the dialog is OPENED, not on every page load.
  // This saves 15 network requests on initial page load.
  useEffect(() => {
    if (!isOpen || hasPrefetched.current) return;
    hasPrefetched.current = true;

    const client = getTrpcClient();
    // Fire-and-forget prefetch — warm the vanilla client cache
    client.notifications.getPreferences.query().catch(() => {});
    client.user.getPreferences.query().catch(() => {});
    client.user.getProfile.query().catch(() => {});
    client.billing.getSubscription.query().catch(() => {});
    client.billing.listPlans.query().catch(() => {});
    client.billing.listPaymentMethods.query().catch(() => {});
    client.billing.listInvoices.query({ limit: 5 }).catch(() => {});
    client.billing.listCreditPackages.query().catch(() => {});
    client.billing.getCreditBalance.query().catch(() => {});
    client.billing.getUsageSummary.query().catch(() => {});
    client.billing.getUsageRecords.query({ limit: 10 }).catch(() => {});
    client.connectors.listDefinitions.query().catch(() => {});
    client.connectors.list.query().catch(() => {});
    client.webhooks.list.query().catch(() => {});
    client.webhooks.getEventTypes.query().catch(() => {});
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent
        className="max-w-4xl h-[600px] max-h-[90vh] p-0 gap-0 rounded-[20px] overflow-hidden"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-full">
          {/* Navigation Sidebar */}
          <div className="w-[220px] border-r bg-muted/30 shrink-0 flex flex-col">
            <div className="p-4 pb-2">
              <h2 className="font-semibold text-lg">Settings</h2>
            </div>
            <ScrollArea className="flex-1">
              <SettingsNav />
            </ScrollArea>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            <SettingsContent user={user} isPro={isPro} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
