"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { CrownIcon, SparklesIcon, TrendingUpIcon, AlertCircleIcon, CpuIcon, HardDriveIcon, GlobeIcon, HammerIcon, XIcon } from "lucide-react";
import {
  useGetUsageSummaryQuery,
  useGetUsageRecordsQuery,
} from "@/lib/store/api/api.slice";
import { useAppSelector, useAppDispatch, useWebDevUsage } from "@/lib/store/hooks";
import { dismissAlert } from "@/lib/store/slices/webDevUsage.slice";
import { useSettings } from "../settings-context";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

type UsageTabProps = {
  isPro?: boolean;
};

export function UsageTab({ isPro = false }: UsageTabProps) {
  const { setActiveTab } = useSettings();

  // Read core billing data from Redux (hydrated by ReduxDataLoader)
  const creditBreakdown = useAppSelector((state) => state.billing.creditBreakdown);
  const reduxSubscription = useAppSelector((state) => state.billing.subscription);
  const isLoadingBilling = useAppSelector((state) => state.billing.isSubscriptionLoading);

  // RTK Query for usage data
  const { data: usageSummary, isLoading: isLoadingSummary, isError: isSummaryError, refetch: refetchUsageSummary } = useGetUsageSummaryQuery(undefined, {
    selectFromResult: ({ data, ...rest }) => ({ data: data as Record<string, any> | undefined, ...rest }),
  });
  const { data: usageRecords, isLoading: isLoadingRecords } = useGetUsageRecordsQuery({ limit: 10 }, {
    selectFromResult: ({ data, ...rest }) => ({ data: data as any[] | undefined, ...rest }),
  });

  const isLoading = isLoadingBilling || isLoadingSummary || isLoadingRecords;
  const isError = isSummaryError;

  // Calculate totals from Redux credit breakdown
  const totalCredits = creditBreakdown.total;
  const periodCredits = creditBreakdown.monthly.total;
  const periodUsed = creditBreakdown.monthly.used;
  const purchasedCredits = creditBreakdown.purchased.available;

  const usagePercent = periodCredits > 0 ? (periodUsed / periodCredits) * 100 : 0;
  const isSubscribed = reduxSubscription !== null;
  const planName = reduxSubscription ? reduxSubscription.plan.charAt(0).toUpperCase() + reduxSubscription.plan.slice(1) : "Free";

  // Group usage by date for display
  const groupedUsage = (usageRecords ?? []).reduce<Record<string, { tasks: number; credits: number }>>((acc, record) => {
    const date = format(new Date(record.createdAt), "MMM d");
    if (!acc[date]) {
      acc[date] = { tasks: 0, credits: 0 };
    }
    acc[date].tasks += 1;
    acc[date].credits += record.credits;
    return acc;
  }, {});

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
            refetchUsageSummary();
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
                ? `Renews ${reduxSubscription?.currentPeriodEnd ? format(new Date(reduxSubscription.currentPeriodEnd), "MMM d, yyyy") : "soon"}`
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
      {creditBreakdown.autoTopupEnabled && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Auto Top-up</h3>
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto top-up enabled</p>
                  <p className="text-xs text-muted-foreground">
                    Credits will be purchased automatically when balance is low
                  </p>
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
            </div>
          </div>
        </>
      )}

      {/* WebDev Usage Section */}
      <WebDevUsageSection />
    </div>
  );
}

function WebDevUsageSection() {
  const dispatch = useAppDispatch();
  const webDevUsage = useWebDevUsage();
  const { usageInfo, budgetSettings, usageAlerts } = webDevUsage;

  const activeAlerts = usageAlerts.filter((a) => !a.dismissed);

  // Only render if there's WebDev usage data
  if (!usageInfo) return null;

  const breakdown = usageInfo.breakdown;
  const breakdownItems = [
    { label: "Compute", value: breakdown.compute, icon: CpuIcon },
    { label: "Storage", value: breakdown.storage, icon: HardDriveIcon },
    { label: "Bandwidth", value: breakdown.bandwidth, icon: GlobeIcon },
    { label: "Builds", value: breakdown.builds, icon: HammerIcon },
  ];

  return (
    <>
      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">WebDev Usage</h3>

        {/* Usage Alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                  alert.severity === "critical"
                    ? "border-destructive/50 bg-destructive/5 text-destructive"
                    : "border-amber-500/50 bg-amber-500/5 text-amber-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertCircleIcon className="h-4 w-4 shrink-0" />
                  <span>{alert.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(dismissAlert(alert.id))}
                  className="shrink-0 p-1 hover:opacity-70"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Breakdown */}
        <div className="grid gap-4 md:grid-cols-4">
          {breakdownItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                <div className="text-xl font-semibold">{item.value.toLocaleString()}</div>
              </div>
            );
          })}
        </div>

        {/* Overall Progress */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {usageInfo.totalUsed.toLocaleString()} / {usageInfo.totalLimit.toLocaleString()} credits
              </span>
              <span className="text-xs text-muted-foreground">
                {usageInfo.usedPercentage}%
              </span>
            </div>
            <Progress value={usageInfo.usedPercentage} className="h-2" />
          </CardContent>
        </Card>

        {/* Budget Settings */}
        <div className="rounded-lg border p-4 space-y-2">
          <h4 className="text-sm font-medium">Budget Settings</h4>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Alert threshold</span>
            <span>{budgetSettings.alertThreshold}%</span>
          </div>
          {budgetSettings.globalLimit && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Global limit</span>
              <span>{budgetSettings.globalLimit.toLocaleString()} credits</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Auto-stop on limit</span>
            <Badge variant={budgetSettings.autoStopOnLimit ? "default" : "secondary"} className="text-xs">
              {budgetSettings.autoStopOnLimit ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      </div>
    </>
  );
}
