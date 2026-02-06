"use client";

import { Dialog, DialogContent, DialogTitle } from "@repo/design-system/components/ui/dialog";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { useSettings } from "./settings-context";
import { SettingsContent } from "./settings-content";
import { SettingsNav } from "./settings-nav";
import { trpc } from "@/lib/trpc/client";
import { useEffect } from "react";

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
  const utils = trpc.useUtils();

  useEffect(() => {
    // Prefetch key settings data early so tabs are instant on open.
    utils.notifications.getPreferences.prefetch();
    utils.user.getPreferences.prefetch();
    utils.user.getProfile.prefetch();
    utils.billing.getSubscription.prefetch();
    utils.billing.listPlans.prefetch();
    utils.billing.listPaymentMethods.prefetch();
    utils.billing.listInvoices.prefetch({ limit: 5 });
    utils.billing.listCreditPackages.prefetch();
    utils.billing.getCreditBalance.prefetch();
    utils.billing.getUsageSummary.prefetch();
    utils.billing.getUsageRecords.prefetch({ limit: 10 });
    utils.connectors.listDefinitions.prefetch();
    utils.connectors.list.prefetch();
    utils.webhooks.list.prefetch();
    utils.webhooks.getEventTypes.prefetch();
    // webhooks.getDeliveries requires a webhookId — prefetched on-demand in the tab
    // mail.getOrCreateMailbox depends on agent_mailboxes table — prefetched on-demand
  }, [utils]);

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
