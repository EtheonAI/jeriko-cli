"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Popover, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { SparklesIcon } from "lucide-react";
import { useAppSelector } from "@/lib/store/hooks";
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
  credits: creditsProp = 0,
  isPro: isProProp = false,
  expirationDate,
  freeCredits,
  monthlyCredits,
  dailyRefreshCredits,
  dailyRefreshMax,
}: CreditsButtonProps) {
  const [mounted, setMounted] = useState(false);

  // Read billing from Redux (hydrated by ReduxDataLoader)
  const creditBreakdown = useAppSelector((state) => state.billing.creditBreakdown);
  const subscription = useAppSelector((state) => state.billing.subscription);

  // Use Redux data, fall back to props
  const credits = creditBreakdown.total || creditsProp;
  const isPro = subscription ? subscription.plan !== "free" : isProProp;

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 rounded-full px-3" disabled>
        <SparklesIcon className="h-4 w-4 text-amber-500" />
        <span className="font-medium">--</span>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full px-3">
          <SparklesIcon className="h-4 w-4 text-amber-500" />
          <span className="font-medium">{credits.toLocaleString()}</span>
        </Button>
      </PopoverTrigger>
      <CreditsDropdown
        isPro={isPro}
        expirationDate={expirationDate ?? subscription?.currentPeriodEnd}
        freeCredits={freeCredits ?? creditBreakdown.daily.available}
        monthlyCredits={monthlyCredits ?? creditBreakdown.monthly.available}
        dailyRefreshCredits={dailyRefreshCredits ?? creditBreakdown.daily.refreshAmount}
        dailyRefreshMax={dailyRefreshMax ?? creditBreakdown.daily.total}
      />
    </Popover>
  );
}
