"use client";

import { useState, useEffect, useCallback } from "react";
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
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import {
  setSubscription as setSubscriptionAction,
  setPaymentMethods as setPaymentMethodsAction,
  setInvoices as setInvoicesAction,
  type Subscription,
} from "@/lib/store/slices/billing.slice";
import { toast } from "sonner";
import { format } from "date-fns";
import { ErrorState } from "./error-state";

type BillingTabProps = {
  isPro?: boolean;
};

export function BillingTab({ isPro = false }: BillingTabProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const dispatch = useAppDispatch();

  // Read core billing data from Redux (hydrated by ReduxDataLoader)
  const plans = useAppSelector((state) => state.billing.personalPlanTiers);
  const reduxSubscription = useAppSelector((state) => state.billing.subscription);
  const isLoadingPlans = useAppSelector((state) => state.billing.isSubscriptionLoading);
  const creditPackages = useAppSelector((state) => state.billing.creditPackages);

  // Lazy-fetch data only needed in this tab (not app-critical)
  const [paymentMethods, setPaymentMethods] = useState<any[] | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);

  // Mutation pending states
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const data = await getTrpcClient().billing.listPaymentMethods.query();
      setPaymentMethods(data);
    } catch {
      setPaymentMethods([]);
    } finally {
      setIsLoadingPayments(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await getTrpcClient().billing.listInvoices.query({ limit: 5 });
      setInvoices(data);
    } catch {
      setInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentMethods();
    fetchInvoices();
  }, [fetchPaymentMethods, fetchInvoices]);

  // Mutations as async callbacks

  const handleCreateCheckout = useCallback(async (planId: string, interval: "monthly" | "yearly") => {
    setSelectedPlan(planId);
    setIsCreatingCheckout(true);
    try {
      const data = await getTrpcClient().billing.createSubscriptionCheckout.mutate({
        planId,
        interval,
        successUrl: `${window.location.origin}/settings?tab=billing&success=true`,
        cancelUrl: `${window.location.origin}/settings?tab=billing`,
      });
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.info("Stripe checkout not yet configured");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create checkout");
    } finally {
      setIsCreatingCheckout(false);
    }
  }, []);

  const handleCancelSubscription = useCallback(async () => {
    setIsCancellingSubscription(true);
    try {
      await getTrpcClient().billing.cancelSubscription.mutate({
        cancelAtPeriodEnd: true,
        reason: cancelReason,
      });
      toast.success("Subscription cancelled. You'll have access until the end of your billing period.");
      if (reduxSubscription) dispatch(setSubscriptionAction({ ...reduxSubscription, cancelAtPeriodEnd: true }));
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel subscription");
    } finally {
      setIsCancellingSubscription(false);
    }
  }, [cancelReason, reduxSubscription, dispatch]);

  const handleReactivateSubscription = useCallback(async () => {
    setIsReactivating(true);
    try {
      await getTrpcClient().billing.reactivateSubscription.mutate();
      toast.success("Subscription reactivated");
      if (reduxSubscription) dispatch(setSubscriptionAction({ ...reduxSubscription, cancelAtPeriodEnd: false }));
    } catch (error: any) {
      toast.error(error?.message || "Failed to reactivate subscription");
    } finally {
      setIsReactivating(false);
    }
  }, [reduxSubscription, dispatch]);

  const handleSetDefaultPayment = useCallback(async (id: string) => {
    setIsSettingDefault(true);
    try {
      await getTrpcClient().billing.setDefaultPaymentMethod.mutate({ id });
      toast.success("Default payment method updated");
      await fetchPaymentMethods();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update payment method");
    } finally {
      setIsSettingDefault(false);
    }
  }, [fetchPaymentMethods]);

  const handleDeletePayment = useCallback(async (id: string) => {
    setIsDeletingPayment(true);
    try {
      await getTrpcClient().billing.deletePaymentMethod.mutate({ id });
      toast.success("Payment method removed");
      await fetchPaymentMethods();
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove payment method");
    } finally {
      setIsDeletingPayment(false);
    }
  }, [fetchPaymentMethods]);

  const handleGetBillingPortal = useCallback(async (returnUrl: string) => {
    setIsOpeningPortal(true);
    try {
      const data = await getTrpcClient().billing.getBillingPortalUrl.mutate({ returnUrl });
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast.info("Billing portal not yet configured");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to open billing portal");
    } finally {
      setIsOpeningPortal(false);
    }
  }, []);

  const isLoading = isLoadingPlans || isLoadingPayments;

  const isSubscribed = reduxSubscription !== null;
  const isCancelling = reduxSubscription?.cancelAtPeriodEnd;
  const currentPlanType = reduxSubscription?.plan || "free";
  const currentPlanName = currentPlanType.charAt(0).toUpperCase() + currentPlanType.slice(1);

  const handleUpgrade = (planId: string, interval: "monthly" | "yearly") => {
    handleCreateCheckout(planId, interval);
  };

  const handleCancel = () => {
    handleCancelSubscription();
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

  const billingError = useAppSelector((state) => state.billing.error);

  if (billingError) {
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
          onRetry={() => window.location.reload()}
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
              <span className="font-semibold">{currentPlanName} Plan</span>
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
                  ? `Access until ${reduxSubscription?.currentPeriodEnd ? format(new Date(reduxSubscription.currentPeriodEnd), "MMM d, yyyy") : "end of period"}`
                  : `Renews on ${reduxSubscription?.currentPeriodEnd ? format(new Date(reduxSubscription.currentPeriodEnd), "MMM d, yyyy") : "soon"}`
                : "Upgrade to unlock more features"
              }
            </p>
          </div>
          {isSubscribed ? (
            isCancelling ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReactivateSubscription()}
                disabled={isReactivating}
              >
                {isReactivating && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
                Reactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGetBillingPortal(window.location.href)}
                disabled={isOpeningPortal}
              >
                {isOpeningPortal ? (
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
            const isCurrentPlan = currentPlanType === plan.plan;
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
                    disabled={isCurrentPlan || isCreatingCheckout}
                    onClick={() => handleUpgrade(plan.id, "monthly")}
                  >
                    {isCreatingCheckout && selectedPlan === plan.id && (
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
                      onClick={() => handleSetDefaultPayment(method.id)}
                      disabled={isSettingDefault}
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
                          onClick={() => handleDeletePayment(method.id)}
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
            onClick={() => handleGetBillingPortal(window.location.href)}
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
              onClick={() => handleGetBillingPortal(window.location.href)}
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
                    {isCancellingSubscription && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
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
