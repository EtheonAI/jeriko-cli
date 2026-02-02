"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  PopoverContent,
} from "@repo/design-system/components/ui/popover";
import { Separator } from "@repo/design-system/components/ui/separator";
import { CrownIcon, RefreshCwIcon } from "lucide-react";
import { useSettings } from "../settings/settings-context";

type CreditsDropdownProps = {
  isPro?: boolean;
  expirationDate?: string;
  freeCredits?: number;
  monthlyCredits?: number;
  dailyRefreshCredits?: number;
  dailyRefreshMax?: number;
};

export function CreditsDropdown({
  isPro = false,
  expirationDate = "Dec 31, 2025",
  freeCredits = 100,
  monthlyCredits = 500,
  dailyRefreshCredits = 300,
  dailyRefreshMax = 300,
}: CreditsDropdownProps) {
  const { openSettings } = useSettings();

  return (
    <PopoverContent align="end" className="w-72 p-0">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isPro ? (
              <>
                <CrownIcon className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm">Pro</span>
              </>
            ) : (
              <span className="font-medium text-sm">Free Plan</span>
            )}
          </div>
          {isPro && (
            <Badge variant="outline" className="text-[10px]">
              Expires {expirationDate}
            </Badge>
          )}
        </div>

        <Button className="w-full" size="sm">
          Add credits
        </Button>
      </div>

      <Separator />

      <div className="p-4 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Credits Breakdown
        </h4>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Free credits</span>
            <span className="text-sm font-medium">{freeCredits.toLocaleString()}</span>
          </div>

          {isPro && (
            <div className="flex items-center justify-between">
              <span className="text-sm">Monthly credits</span>
              <span className="text-sm font-medium">{monthlyCredits.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <RefreshCwIcon className="h-3 w-3" />
          <span className="text-xs">Daily refresh credits</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 bg-muted rounded-full h-2 mr-3">
            <div
              className="bg-primary rounded-full h-2 transition-all"
              style={{
                width: `${(dailyRefreshCredits / dailyRefreshMax) * 100}%`,
              }}
            />
          </div>
          <span className="text-sm font-medium">
            {dailyRefreshCredits}/{dailyRefreshMax}
          </span>
        </div>
      </div>

      <Separator />

      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sm"
          onClick={() => openSettings("usage")}
        >
          View usage
        </Button>
      </div>
    </PopoverContent>
  );
}
