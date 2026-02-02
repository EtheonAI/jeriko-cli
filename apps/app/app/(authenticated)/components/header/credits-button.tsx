"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Popover,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { SparklesIcon } from "lucide-react";
import { CreditsDropdown } from "./credits-dropdown";

type CreditsButtonProps = {
  credits?: number;
  isPro?: boolean;
  expirationDate?: string;
  freeCredits?: number;
  monthlyCredits?: number;
  dailyRefreshCredits?: number;
  dailyRefreshMax?: number;
};

export function CreditsButton({
  credits = 0,
  isPro = false,
  expirationDate,
  freeCredits,
  monthlyCredits,
  dailyRefreshCredits,
  dailyRefreshMax,
}: CreditsButtonProps) {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full px-3"
        disabled
      >
        <SparklesIcon className="h-4 w-4 text-amber-500" />
        <span className="font-medium">{credits}</span>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full px-3"
        >
          <SparklesIcon className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{credits.toLocaleString()}</span>
        </Button>
      </PopoverTrigger>
      <CreditsDropdown
        isPro={isPro}
        expirationDate={expirationDate}
        freeCredits={freeCredits}
        monthlyCredits={monthlyCredits}
        dailyRefreshCredits={dailyRefreshCredits}
        dailyRefreshMax={dailyRefreshMax}
      />
    </Popover>
  );
}
