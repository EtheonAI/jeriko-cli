"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { useSettings } from "./settings-context";
import { SettingsContent } from "./settings-content";
import { SettingsNav } from "./settings-nav";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent
        className="max-w-[920px] h-[600px] max-h-[95vh] p-0 gap-0 rounded-[20px] overflow-hidden"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <div className="flex h-full">
          <div className="w-[221px] border-r bg-muted/30 shrink-0">
            <div className="p-4 pb-2">
              <h2 className="font-semibold text-lg">Settings</h2>
            </div>
            <ScrollArea className="h-[calc(600px-60px)]">
              <SettingsNav />
            </ScrollArea>
          </div>
          <div className="flex-1 overflow-hidden">
            <SettingsContent user={user} isPro={isPro} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
