"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ConstructionIcon } from "lucide-react";

type PlaceholderTabProps = {
  title: string;
  description?: string;
};

export function PlaceholderTab({ title, description }: PlaceholderTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <Separator />

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <ConstructionIcon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Coming Soon</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          We&apos;re working hard to bring you this feature. Stay tuned for updates!
        </p>
        <Button variant="outline" className="mt-6">
          Get notified
        </Button>
      </div>
    </div>
  );
}
