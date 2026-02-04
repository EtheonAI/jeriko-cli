"use client";

import { useState } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { CheckIcon, CreditCardIcon, CrownIcon, PlusIcon, Loader2Icon, ExternalLinkIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

type BillingTabProps = {
  isPro?: boolean;
};

export function BillingTab({ isPro = false }: BillingTabProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Fetch data with error handling
  const { data: plans, isLoading: isLoadingPlans, isError: isPlansError, refetch: refetchPlans } = trpc.billing.listPlans.useQuery(undefined, { retry: 1 });
  const { data: subscription, isLoading: isLoadingSubscription, isError: isSubscriptionError, refetch: refetchSubscription } = trpc.billing.getSubscription.useQuery(undefined, { retry: 1 });
  const { data: paymentMethods, isLoading: isLoadingPayments } = trpc.billing.listPaymentMethods.useQuery(undefined, { retry: 1 });
  const { data: invoices, isLoading: isLoadingInvoices } = trpc.billing.listInvoices.useQuery({ limit: 5 }, { retry: 1 });
  const { data: creditPackages } = trpc.billing.listCreditPackages.useQuery(undefined, { retry: 1 });

  // Mutations
  const utils = trpc.useUtils();

  const createCheckout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.info("Stripe checkout not yet configured");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create checkout");
    },
  });

  const cancelSubscription = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription cancelled. You'll have access until the end of your billing period.");
      utils.billing.getSubscription.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel subscription");
    },
  });

  const reactivateSubscription = trpc.billing.reactivateSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription reactivated");
      utils.billing.getSubscription.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reactivate subscription");
    },
  });

  const setDefaultPayment = trpc.billing.setDefaultPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Default payment method updated");
      utils.billing.listPaymentMethods.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update payment method");
    },
  });

  const deletePayment = trpc.billing.deletePaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Payment method removed");
      utils.billing.listPaymentMethods.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove payment method");
    },
  });

  const getBillingPortal = trpc.billing.getBillingPortalUrl.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast.info("Billing portal not yet configured");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to open billing portal");
    },
  });

  const isLoading = isLoadingPlans || isLoadingSubscription || isLoadingPayments;

  const currentPlan = subscription?.plan;
  const isSubscribed = subscription !== null;
  const isCancelling = subscription?.subscription?.cancelAtPeriodEnd;

  const handleUpgrade = (planId: string, interval: "monthly" | "yearly") => {
    setSelectedPlan(planId);
    createCheckout.mutate({
      planId,
      interval,
      successUrl: `${window.location.origin}/settings?tab=billing&success=true`,
      cancelUrl: `${window.location.origin}/settings?tab=billing`,
    });
  };

  const handleCancel = () => {
    cancelSubscription.mutate({
      cancelAtPeriodEnd: true,
      reason: cancelReason,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and payment methods.
          </p>
        </div>
        <Separator />
        <Skeleton className="h-24" />
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isPlansError || isSubscriptionError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and payment methods.
          </p>
        </div>
        <Separator />
        <ErrorState
          title="Failed to load billing information"
          message="Unable to load your billing details. Please try again."
          onRetry={() => {
            refetchPlans();
            refetchSubscription();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and payment methods.
        </p>
      </div>

      <Separator />

      {/* Current Plan */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Current Plan</h3>

        <div className="flex items-center gap-4 rounded-lg border p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CrownIcon className={`h-6 w-6 ${isSubscribed ? "text-amber-500" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{currentPlan?.name || "Free"} Plan</span>
              {isSubscribed && !isCancelling && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
              {isCancelling && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  Cancelling
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isSubscribed
                ? isCancelling
                  ? `Access until ${subscription?.subscription?.currentPeriodEnd ? format(new Date(subscription.subscription.currentPeriodEnd), "MMM d, yyyy") : "end of period"}`
                  : `Renews on ${subscription?.subscription?.currentPeriodEnd ? format(new Date(subscription.subscription.currentPeriodEnd), "MMM d, yyyy") : "soon"}`
                : "Upgrade to unlock more features"
              }
            </p>
          </div>
          {isSubscribed ? (
            isCancelling ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reactivateSubscription.mutate()}
                disabled={reactivateSubscription.isPending}
              >
                {reactivateSubscription.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Reactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => getBillingPortal.mutate({ returnUrl: window.location.href })}
                disabled={getBillingPortal.isPending}
              >
                {getBillingPortal.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLinkIcon className="h-4 w-4 mr-2" />
                )}
                Manage
              </Button>
            )
          ) : (
            <Button size="sm" onClick={() => document.getElementById("plans-section")?.scrollIntoView({ behavior: "smooth" })}>
              Upgrade
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Available Plans */}
      <div className="space-y-4" id="plans-section">
        <h3 className="text-sm font-medium">Available Plans</h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans?.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const monthlyPrice = (plan.priceMonthly || 0) / 100;
            const yearlyPrice = (plan.priceYearly || 0) / 100;

            return (
              <Card
                key={plan.id}
                className={plan.isPopular ? "border-primary" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.isPopular && (
                      <Badge variant="default" className="text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground">
                      ${monthlyPrice}
                    </span>
                    <span className="text-muted-foreground"> / month</span>
                  </CardDescription>
                  {yearlyPrice > 0 && plan.discountYearlyPercent && (
                    <p className="text-xs text-green-600">
                      Save {plan.discountYearlyPercent}% with yearly billing
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckIcon className="h-4 w-4 text-green-500" />
                      {plan.monthlyCredits?.toLocaleString() || 0} credits/month
                    </li>
                    {(plan.features as string[] || []).slice(0, 4).map((feature: string) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckIcon className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.isPopular ? "default" : "outline"}
                    disabled={isCurrentPlan || createCheckout.isPending}
                    onClick={() => handleUpgrade(plan.id, "monthly")}
                  >
                    {createCheckout.isPending && selectedPlan === plan.id && (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    )}
                    {isCurrentPlan ? "Current plan" : `Get ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Payment Methods */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Payment Methods</h3>

        <div className="space-y-2">
          {paymentMethods && paymentMethods.length > 0 ? (
            paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <CreditCardIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {method.brand || method.type} ending in {method.last4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires {method.expiryMonth}/{method.expiryYear}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {method.isDefault && (
                    <Badge variant="outline" className="text-xs">
                      Default
                    </Badge>
                  )}
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultPayment.mutate({ id: method.id })}
                      disabled={setDefaultPayment.isPending}
                    >
                      Set default
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove payment method?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove this payment method from your account.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deletePayment.mutate({ id: method.id })}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
              No payment methods on file
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => getBillingPortal.mutate({ returnUrl: window.location.href })}
          >
            <PlusIcon className="h-4 w-4" />
            Add payment method
          </Button>
        </div>
      </div>

      <Separator />

      {/* Billing History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Billing History</h3>
          {invoices && invoices.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => getBillingPortal.mutate({ returnUrl: window.location.href })}
            >
              View all
            </Button>
          )}
        </div>

        {invoices && invoices.length > 0 ? (
          <div className="rounded-lg border">
            <div className="grid grid-cols-4 gap-4 border-b p-3 text-sm font-medium text-muted-foreground">
              <div>Date</div>
              <div>Description</div>
              <div>Amount</div>
              <div>Status</div>
            </div>
            {invoices.map((invoice, index) => (
              <div
                key={invoice.id}
                className={`grid grid-cols-4 gap-4 p-3 text-sm ${
                  index !== invoices.length - 1 ? "border-b" : ""
                }`}
              >
                <div>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</div>
                <div>{invoice.description || "Subscription"}</div>
                <div>${((invoice.total || 0) / 100).toFixed(2)}</div>
                <div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${invoice.status === "paid" ? "text-green-600" : ""}`}
                  >
                    {invoice.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            No billing history yet
          </div>
        )}
      </div>

      {/* Cancel Subscription */}
      {isSubscribed && !isCancelling && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Cancel Subscription</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Cancel subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll continue to have access until the end of your current billing period.
                    Your credits will remain available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                  <label className="text-sm text-muted-foreground">
                    Help us improve - why are you cancelling? (optional)
                  </label>
                  <textarea
                    className="mt-2 w-full rounded-md border p-2 text-sm"
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Tell us why..."
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancelSubscription.isPending && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                    Cancel subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  );
}
