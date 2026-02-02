"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Progress } from "@repo/design-system/components/ui/progress";
import { Separator } from "@repo/design-system/components/ui/separator";
import { CrownIcon, SparklesIcon, TrendingUpIcon } from "lucide-react";

type UsageTabProps = {
  isPro?: boolean;
  credits?: {
    total: number;
    used: number;
    free: number;
    monthly: number;
    dailyRefresh: number;
    dailyRefreshMax: number;
  };
};

const defaultCredits = {
  total: 600,
  used: 234,
  free: 100,
  monthly: 500,
  dailyRefresh: 300,
  dailyRefreshMax: 300,
};

const usageHistory = [
  { date: "Today", tasks: 12, credits: 45 },
  { date: "Yesterday", tasks: 8, credits: 32 },
  { date: "Dec 28", tasks: 15, credits: 58 },
  { date: "Dec 27", tasks: 6, credits: 24 },
  { date: "Dec 26", tasks: 10, credits: 41 },
];

export function UsageTab({ isPro = false, credits = defaultCredits }: UsageTabProps) {
  const remaining = credits.total - credits.used;
  const usagePercent = (credits.used / credits.total) * 100;

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
            <div className="text-2xl font-bold">{remaining.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {credits.used.toLocaleString()} used of {credits.total.toLocaleString()}
            </p>
            <Progress value={usagePercent} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <CrownIcon className={`h-4 w-4 ${isPro ? "text-amber-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{isPro ? "Pro" : "Free"}</span>
              {isPro && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isPro ? "Unlimited access to all features" : "Limited to basic features"}
            </p>
            {!isPro && (
              <Button size="sm" className="mt-2">
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
            <div className="text-sm text-muted-foreground">Free credits</div>
            <div className="text-xl font-semibold">{credits.free.toLocaleString()}</div>
          </div>

          {isPro && (
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Monthly credits</div>
              <div className="text-xl font-semibold">{credits.monthly.toLocaleString()}</div>
            </div>
          )}

          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Daily refresh</div>
            <div className="text-xl font-semibold">
              {credits.dailyRefresh}/{credits.dailyRefreshMax}
            </div>
            <Progress
              value={(credits.dailyRefresh / credits.dailyRefreshMax) * 100}
              className="mt-2 h-1"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Usage History</h3>
          <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
        </div>

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
      </div>
    </div>
  );
}
