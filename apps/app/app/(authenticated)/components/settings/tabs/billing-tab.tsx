"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { CheckIcon, CreditCardIcon, CrownIcon, PlusIcon } from "lucide-react";

type BillingTabProps = {
  isPro?: boolean;
  subscriptionEndDate?: string;
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "100 credits per month",
      "Basic AI capabilities",
      "Community support",
      "Standard response time",
    ],
  },
  {
    name: "Pro",
    price: "$20",
    period: "per month",
    features: [
      "500 credits per month",
      "Advanced AI capabilities",
      "Priority support",
      "Faster response time",
      "Custom integrations",
      "API access",
    ],
    popular: true,
  },
];

const paymentMethods = [
  {
    id: "1",
    type: "Visa",
    last4: "4242",
    expiry: "12/25",
    isDefault: true,
  },
];

const billingHistory = [
  { date: "Dec 1, 2024", description: "Pro subscription", amount: "$20.00", status: "Paid" },
  { date: "Nov 1, 2024", description: "Pro subscription", amount: "$20.00", status: "Paid" },
  { date: "Oct 1, 2024", description: "Pro subscription", amount: "$20.00", status: "Paid" },
];

export function BillingTab({ isPro = false, subscriptionEndDate = "Jan 31, 2025" }: BillingTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and payment methods.
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Current Plan</h3>

        <div className="flex items-center gap-4 rounded-lg border p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CrownIcon className={`h-6 w-6 ${isPro ? "text-amber-500" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{isPro ? "Pro" : "Free"} Plan</span>
              {isPro && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isPro
                ? `Your subscription renews on ${subscriptionEndDate}`
                : "Upgrade to unlock more features"}
            </p>
          </div>
          {isPro ? (
            <Button variant="outline" size="sm">
              Manage
            </Button>
          ) : (
            <Button size="sm">Upgrade</Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Available Plans</h3>

        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.popular ? "border-primary" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.popular && (
                    <Badge variant="default" className="text-xs">
                      Popular
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground"> / {plan.period}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckIcon className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={plan.popular ? "default" : "outline"}
                  disabled={
                    (plan.name === "Pro" && isPro) ||
                    (plan.name === "Free" && !isPro)
                  }
                >
                  {plan.name === "Pro" && isPro
                    ? "Current plan"
                    : plan.name === "Free" && !isPro
                      ? "Current plan"
                      : `Switch to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Payment Methods</h3>

        <div className="space-y-2">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {method.type} ending in {method.last4}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {method.expiry}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {method.isDefault && (
                  <Badge variant="outline" className="text-xs">
                    Default
                  </Badge>
                )}
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Add payment method
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Billing History</h3>

        <div className="rounded-lg border">
          <div className="grid grid-cols-4 gap-4 border-b p-3 text-sm font-medium text-muted-foreground">
            <div>Date</div>
            <div>Description</div>
            <div>Amount</div>
            <div>Status</div>
          </div>
          {billingHistory.map((item, index) => (
            <div
              key={`${item.date}-${index}`}
              className={`grid grid-cols-4 gap-4 p-3 text-sm ${
                index !== billingHistory.length - 1 ? "border-b" : ""
              }`}
            >
              <div>{item.date}</div>
              <div>{item.description}</div>
              <div>{item.amount}</div>
              <div>
                <Badge variant="outline" className="text-xs text-green-600">
                  {item.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
