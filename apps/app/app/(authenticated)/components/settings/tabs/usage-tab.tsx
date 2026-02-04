"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { CrownIcon, SparklesIcon, TrendingUpIcon, AlertCircleIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useSettings } from "../settings-context";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

type UsageTabProps = {
  isPro?: boolean;
};

export function UsageTab({ isPro = false }: UsageTabProps) {
  const { setActiveTab } = useSettings();

  // Fetch credit balance
  const { data: creditBalance, isLoading: isLoadingBalance, isError: isBalanceError, refetch: refetchBalance } = trpc.billing.getCreditBalance.useQuery(undefined, { retry: 1 });

  // Fetch subscription info
  const { data: subscription, isLoading: isLoadingSubscription, isError: isSubscriptionError, refetch: refetchSubscription } = trpc.billing.getSubscription.useQuery(undefined, { retry: 1 });

  // Fetch usage summary
  const { data: usageSummary, isLoading: isLoadingSummary, isError: isSummaryError, refetch: refetchSummary } = trpc.billing.getUsageSummary.useQuery(undefined, { retry: 1 });

  // Fetch recent usage records
  const { data: usageRecords, isLoading: isLoadingRecords } = trpc.billing.getUsageRecords.useQuery({
    limit: 10,
  }, { retry: 1 });

  const isLoading = isLoadingBalance || isLoadingSubscription || isLoadingSummary || isLoadingRecords;
  const isError = isBalanceError || isSubscriptionError || isSummaryError;

  // Calculate totals
  const totalCredits = creditBalance?.balance || 0;
  const periodCredits = creditBalance?.periodCredits || 0;
  const periodUsed = creditBalance?.periodCreditsUsed || 0;
  const purchasedCredits = creditBalance?.purchasedCredits || 0;

  const usagePercent = periodCredits > 0 ? (periodUsed / periodCredits) * 100 : 0;
  const isSubscribed = subscription !== null;
  const planName = subscription?.plan?.name || "Free";

  // Group usage by date for display
  const groupedUsage = usageRecords?.reduce((acc, record) => {
    const date = format(new Date(record.createdAt), "MMM d");
    if (!acc[date]) {
      acc[date] = { tasks: 0, credits: 0 };
    }
    acc[date].tasks += 1;
    acc[date].credits += record.credits;
    return acc;
  }, {} as Record<string, { tasks: number; credits: number }>) || {};

  const usageHistory = Object.entries(groupedUsage)
    .slice(0, 5)
    .map(([date, data]) => ({ date, ...data }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Usage</h2>
          <p className="text-sm text-muted-foreground">
            Monitor your credit usage and history.
          </p>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Separator />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Usage</h2>
          <p className="text-sm text-muted-foreground">
            Monitor your credit usage and history.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load usage data"
          message="Unable to load your usage information. Please try again."
          onRetry={() => {
            refetchBalance();
            refetchSubscription();
            refetchSummary();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Usage</h2>
        <p className="text-sm text-muted-foreground">
          Monitor your credit usage and history.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <SparklesIcon className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCredits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {periodUsed.toLocaleString()} used of {periodCredits.toLocaleString()} this period
            </p>
            <Progress value={usagePercent} className="mt-2 h-2" />
            {usagePercent > 80 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                <AlertCircleIcon className="h-3 w-3" />
                Running low on credits
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <CrownIcon className={`h-4 w-4 ${isSubscribed ? "text-amber-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{planName}</span>
              {isSubscribed && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isSubscribed
                ? `Renews ${subscription?.subscription?.currentPeriodEnd ? format(new Date(subscription.subscription.currentPeriodEnd), "MMM d, yyyy") : "soon"}`
                : "Limited to basic features"
              }
            </p>
            {!isSubscribed && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setActiveTab("billing")}
              >
                Upgrade to Pro
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Credits Breakdown</h3>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Period Credits</div>
            <div className="text-xl font-semibold">{periodCredits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Monthly allocation
            </p>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Period Used</div>
            <div className="text-xl font-semibold">{periodUsed.toLocaleString()}</div>
            <Progress
              value={usagePercent}
              className="mt-2 h-1"
            />
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Purchased Credits</div>
            <div className="text-xl font-semibold">{purchasedCredits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Never expire
            </p>
          </div>
        </div>
      </div>

      {usageSummary && usageSummary.byType && Object.keys(usageSummary.byType).length > 0 && (
        <>
          <Separator />

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Usage by Type</h3>

            <div className="grid gap-4 md:grid-cols-4">
              {Object.entries(usageSummary.byType).map(([type, credits]) => (
                <div key={type} className="rounded-lg border p-4">
                  <div className="text-sm text-muted-foreground capitalize">{type}</div>
                  <div className="text-xl font-semibold">{(credits as number).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Usage History</h3>
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        {usageHistory.length > 0 ? (
          <div className="rounded-lg border">
            <div className="grid grid-cols-3 gap-4 border-b p-3 text-sm font-medium text-muted-foreground">
              <div>Date</div>
              <div>Tasks</div>
              <div>Credits</div>
            </div>
            {usageHistory.map((item, index) => (
              <div
                key={item.date}
                className={`grid grid-cols-3 gap-4 p-3 text-sm ${
                  index !== usageHistory.length - 1 ? "border-b" : ""
                }`}
              >
                <div>{item.date}</div>
                <div>{item.tasks}</div>
                <div>{item.credits}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No usage recorded yet. Start using Rubic to see your usage history.
            </p>
          </div>
        )}
      </div>

      {/* Auto top-up settings */}
      {creditBalance?.autoTopupEnabled && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Auto Top-up</h3>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto top-up enabled</p>
                  <p className="text-xs text-muted-foreground">
                    Credits will be purchased automatically when balance falls below {"autoTopupThreshold" in creditBalance ? creditBalance.autoTopupThreshold || 100 : 100}
                  </p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
