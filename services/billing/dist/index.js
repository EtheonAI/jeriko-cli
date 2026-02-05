import H from "fastify";
import j from "fastify-raw-body";
import N from "stripe";
import {
  createLogger as W,
  getEnv as x,
  createId as F,
  dispatchWebhookEvent as K,
} from "@repo/service-utils";
import {
  db as s,
  users as h,
  subscriptionPlans as v,
  userSubscriptions as l,
  creditPackages as U,
  creditBalances as I,
  creditTransactions as G,
  usageRecords as E,
  paymentMethods as A,
  invoices as R,
  eq as i,
  and as $,
  desc as L,
  sql as M,
  gte as V,
  lte as Y,
} from "@repo/database";
var b = W({ service: "billing" }),
  P = new N(x("STRIPE_SECRET_KEY", ""), { apiVersion: "2025-09-30.clover" });
async function q(w) {
  let [f] = await s
    .select({ stripeCustomerId: h.stripeCustomerId, email: h.email, name: h.name })
    .from(h)
    .where(i(h.id, w))
    .limit(1);
  if (!f) return null;
  if (f.stripeCustomerId) return f.stripeCustomerId;
  let c = await P.customers.create({
    email: f.email,
    name: f.name ?? void 0,
    metadata: { userId: w },
  });
  return await s.update(h).set({ stripeCustomerId: c.id }).where(i(h.id, w)), c.id;
}
async function T(w, f, c, k, o, a, r) {
  let [n] = await s.select().from(I).where(i(I.userId, w)).limit(1),
    e = (n?.balance ?? 0) + f;
  if (n) {
    let t = { balance: e };
    c === "subscription_grant" && r
      ? ((t.periodCredits = f),
        (t.periodCreditsUsed = 0),
        (t.periodStart = r.periodStart),
        (t.periodEnd = r.periodEnd))
      : c === "purchase" && (t.purchasedCredits = M`${I.purchasedCredits} + ${f}`),
      await s.update(I).set(t).where(i(I.userId, w));
  } else {
    let t = { id: F(), userId: w, balance: e };
    c === "subscription_grant" && r
      ? ((t.periodCredits = f),
        (t.periodCreditsUsed = 0),
        (t.periodStart = r.periodStart),
        (t.periodEnd = r.periodEnd))
      : c === "purchase" && (t.purchasedCredits = f),
      await s.insert(I).values(t);
  }
  await s
    .insert(G)
    .values({
      id: F(),
      userId: w,
      type: c,
      amount: f,
      balanceAfter: e,
      referenceType: k,
      referenceId: o,
      description: a,
    });
}
function O(w) {
  switch (w) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "trialing":
      return "trialing";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
    case "paused":
      return "past_due";
    default:
      return "active";
  }
}
async function J(w, f) {
  let [c] = await s.select().from(U).where(i(U.id, f)).limit(1);
  if (!c || !c.stripePriceId) return;
  let [k] = await s
    .select()
    .from(A)
    .where($(i(A.userId, w), i(A.isDefault, !0)))
    .limit(1);
  if (!k) return;
  let o = await q(w);
  if (!o) return;
  let a = c.credits + (c.bonusCredits || 0);
  (
    await P.paymentIntents.create({
      amount: c.price,
      currency: c.currency,
      customer: o,
      payment_method: k.stripePaymentMethodId,
      off_session: !0,
      confirm: !0,
      metadata: { userId: w, packageId: f, credits: String(a) },
    })
  ).status === "succeeded" &&
    (await T(w, a, "purchase", "package", f, `Auto top-up: ${c.name}`),
    b.info({ userId: w, packageId: f, credits: a }, "Auto top-up succeeded"));
}
async function z() {
  let w = parseInt(x("PORT", "4008"), 10),
    f = x("HOST", "0.0.0.0"),
    c = H({ logger: !1, requestIdHeader: "x-request-id", genReqId: () => crypto.randomUUID() });
  await c.register(j, { field: "rawBody", global: !1, encoding: "utf8", runFirst: !0 }),
    c.get("/health", async () => ({ status: "ok", service: "billing" })),
    c.get("/plans", async (o, a) => {
      try {
        return { plans: await s.select().from(v).where(i(v.isActive, !0)).orderBy(v.sortOrder) };
      } catch (r) {
        return (
          b.error(r, "Failed to fetch plans"),
          a.status(500).send({ error: "Failed to fetch plans" })
        );
      }
    }),
    c.get("/users/:userId/subscription", async (o, a) => {
      let { userId: r } = o.params;
      try {
        let [n] = await s.select().from(l).where(i(l.userId, r)).limit(1);
        return n || { userId: r, plan: "free", status: "active" };
      } catch (n) {
        return (
          b.error(n, "Failed to fetch subscription"),
          a.status(500).send({ error: "Failed to fetch subscription" })
        );
      }
    }),
    c.post("/subscriptions", async (o, a) => {
      let { userId: r, planId: n, paymentMethodId: p, interval: e = "monthly" } = o.body;
      try {
        let [t] = await s.select().from(v).where(i(v.id, n)).limit(1);
        if (!t) return a.status(404).send({ error: "Plan not found" });
        let d = e === "yearly" ? t.stripePriceIdYearly : t.stripePriceIdMonthly;
        if (!d)
          return a.status(400).send({ error: "Plan does not have a Stripe price configured" });
        let m = await q(r);
        if (!m) return a.status(404).send({ error: "User not found" });
        let u = await P.subscriptions.create({
            customer: m,
            items: [{ price: d }],
            payment_behavior: "default_incomplete",
            ...(p && { default_payment_method: p }),
            metadata: { userId: r, planId: n, interval: e },
            expand: ["latest_invoice.payment_intent"],
          }),
          g = u.items.data[0],
          S = g ? new Date(g.current_period_start * 1e3) : new Date(),
          _ = g ? new Date(g.current_period_end * 1e3) : new Date(),
          [y] = await s
            .insert(l)
            .values({
              id: F(),
              userId: r,
              planId: n,
              stripeSubscriptionId: u.id,
              stripeCustomerId: m,
              interval: e,
              status: O(u.status),
              currentPeriodStart: S,
              currentPeriodEnd: _,
            })
            .returning();
        return (
          await s
            .update(h)
            .set({
              stripeCustomerId: m,
              stripeSubscriptionId: u.id,
              stripePriceId: d,
              stripeCurrentPeriodEnd: _,
            })
            .where(i(h.id, r)),
          u.status === "active" &&
            t.monthlyCredits > 0 &&
            (await T(
              r,
              t.monthlyCredits,
              "subscription_grant",
              "subscription",
              u.id,
              `${t.name} plan - initial credits`,
              { periodStart: S, periodEnd: _ }
            )),
          K({
            eventType: "billing.subscription.created",
            resourceType: "subscription",
            resourceId: y.id,
            payload: { id: y.id, planId: n, status: u.status, stripeSubscriptionId: u.id },
            userId: r,
          }),
          {
            id: y.id,
            userId: r,
            planId: n,
            status: u.status,
            stripeSubscriptionId: u.id,
            clientSecret:
              u.status === "incomplete" ? u.latest_invoice?.payment_intent?.client_secret : void 0,
          }
        );
      } catch (t) {
        return (
          b.error(t, "Failed to create subscription"),
          a.status(500).send({ error: "Failed to create subscription" })
        );
      }
    }),
    c.post("/subscriptions/:id/cancel", async (o, a) => {
      let { id: r } = o.params,
        { immediate: n = !1 } = o.body || {};
      try {
        let [p] = await s.select().from(l).where(i(l.id, r)).limit(1);
        if (!p) return a.status(404).send({ error: "Subscription not found" });
        p.stripeSubscriptionId &&
          (n
            ? await P.subscriptions.cancel(p.stripeSubscriptionId)
            : await P.subscriptions.update(p.stripeSubscriptionId, { cancel_at_period_end: !0 }));
        let [e] = await s
          .update(l)
          .set({ cancelAtPeriodEnd: !n, canceledAt: new Date(), ...(n && { status: "canceled" }) })
          .where(i(l.id, r))
          .returning();
        return { id: e.id, status: n ? "canceled" : "cancel_at_period_end" };
      } catch (p) {
        return (
          b.error(p, "Failed to cancel subscription"),
          a.status(500).send({ error: "Failed to cancel subscription" })
        );
      }
    }),
    c.get("/users/:userId/credits", async (o, a) => {
      let { userId: r } = o.params;
      try {
        let [n] = await s.select().from(I).where(i(I.userId, r)).limit(1);
        return n
          ? { userId: r, balance: n.balance, used: n.periodCreditsUsed }
          : { userId: r, balance: 0, used: 0 };
      } catch (n) {
        return (
          b.error(n, "Failed to fetch credit balance"),
          a.status(500).send({ error: "Failed to fetch credit balance" })
        );
      }
    }),
    c.post("/credits/purchase", async (o, a) => {
      let { userId: r, packageId: n, paymentMethodId: p } = o.body;
      try {
        let [e] = await s.select().from(U).where(i(U.id, n)).limit(1);
        if (!e) return a.status(404).send({ error: "Credit package not found" });
        let t = await q(r);
        if (!t) return a.status(404).send({ error: "User not found" });
        let d = p;
        if (!d) {
          let [S] = await s
            .select()
            .from(A)
            .where($(i(A.userId, r), i(A.isDefault, !0)))
            .limit(1);
          d = S?.stripePaymentMethodId;
        }
        if (!d) return a.status(400).send({ error: "No payment method available" });
        let m = e.credits + (e.bonusCredits || 0),
          u = await P.paymentIntents.create({
            amount: e.price,
            currency: e.currency,
            customer: t,
            payment_method: d,
            off_session: !0,
            confirm: !0,
            metadata: { userId: r, packageId: n, credits: String(m) },
          });
        if (u.status !== "succeeded")
          return a
            .status(402)
            .send({
              error: "Payment requires further action",
              clientSecret: u.client_secret,
              status: u.status,
            });
        await T(r, m, "purchase", "package", n, `Purchased ${e.name}`);
        let [g] = await s.select().from(I).where(i(I.userId, r)).limit(1);
        return {
          credits: m,
          balance: g?.balance ?? m,
          status: "completed",
          stripePaymentIntentId: u.id,
        };
      } catch (e) {
        return (
          b.error(e, "Failed to purchase credits"),
          e instanceof N.errors.StripeCardError
            ? a.status(402).send({ error: e.message, code: e.code })
            : a.status(500).send({ error: "Failed to purchase credits" })
        );
      }
    }),
    c.post("/usage", async (o, a) => {
      let { userId: r, type: n, amount: p, metadata: e } = o.body;
      try {
        let [t] = await s
          .insert(E)
          .values({ id: F(), userId: r, type: n, credits: p, metadata: e })
          .returning();
        await s
          .update(I)
          .set({
            balance: M`${I.balance} - ${p}`,
            periodCreditsUsed: M`${I.periodCreditsUsed} + ${p}`,
          })
          .where(i(I.userId, r));
        let [d] = await s.select().from(I).where(i(I.userId, r)).limit(1);
        return (
          d?.autoTopupEnabled &&
            d.autoTopupPackageId &&
            d.balance <= (d.autoTopupThreshold || 0) &&
            J(r, d.autoTopupPackageId).catch((m) =>
              b.error({ err: m, userId: r }, "Auto top-up failed")
            ),
          { id: t.id, recorded: !0 }
        );
      } catch (t) {
        return (
          b.error(t, "Failed to record usage"),
          a.status(500).send({ error: "Failed to record usage" })
        );
      }
    }),
    c.get("/users/:userId/usage", async (o, a) => {
      let { userId: r } = o.params,
        { from: n, to: p, type: e } = o.query;
      try {
        let t = [i(E.userId, r)];
        n && t.push(V(E.createdAt, new Date(n))),
          p && t.push(Y(E.createdAt, new Date(p))),
          e && t.push(i(E.type, e));
        let d = await s
          .select()
          .from(E)
          .where($(...t))
          .orderBy(L(E.createdAt))
          .limit(100);
        return { usage: d, total: d.length };
      } catch (t) {
        return (
          b.error(t, "Failed to fetch usage history"),
          a.status(500).send({ error: "Failed to fetch usage history" })
        );
      }
    }),
    c.post("/webhooks/stripe", { config: { rawBody: !0 } }, async (o, a) => {
      let r = o.headers["stripe-signature"],
        n = x("STRIPE_WEBHOOK_SECRET", "");
      if (!n)
        return (
          b.error("STRIPE_WEBHOOK_SECRET not configured"),
          a.status(500).send({ error: "Webhook secret not configured" })
        );
      let p;
      try {
        p = P.webhooks.constructEvent(o.rawBody, r, n);
      } catch (e) {
        return (
          b.error({ err: e }, "Stripe webhook signature verification failed"),
          a.status(400).send({ error: "Invalid signature" })
        );
      }
      try {
        switch (p.type) {
          case "checkout.session.completed": {
            let e = p.data.object,
              t = e.metadata?.userId;
            if (!t) break;
            if (e.mode === "subscription") {
              let d = e.metadata?.planId,
                m = e.metadata?.interval,
                u = typeof e.subscription == "string" ? e.subscription : e.subscription?.id;
              if (!u || !d) break;
              let g = await P.subscriptions.retrieve(u),
                S = typeof g.customer == "string" ? g.customer : g.customer.id,
                [_] = await s.select().from(v).where(i(v.id, d)).limit(1),
                y = g.items.data[0],
                C = y ? new Date(y.current_period_start * 1e3) : new Date(),
                D = y ? new Date(y.current_period_end * 1e3) : new Date(),
                [B] = await s.select().from(l).where(i(l.userId, t)).limit(1);
              B
                ? await s
                    .update(l)
                    .set({
                      planId: d,
                      stripeSubscriptionId: u,
                      stripeCustomerId: S,
                      interval: m ?? "monthly",
                      status: "active",
                      currentPeriodStart: C,
                      currentPeriodEnd: D,
                      cancelAtPeriodEnd: !1,
                      canceledAt: null,
                      cancellationReason: null,
                    })
                    .where(i(l.id, B.id))
                : await s
                    .insert(l)
                    .values({
                      id: F(),
                      userId: t,
                      planId: d,
                      stripeSubscriptionId: u,
                      stripeCustomerId: S,
                      interval: m ?? "monthly",
                      status: "active",
                      currentPeriodStart: C,
                      currentPeriodEnd: D,
                    }),
                await s
                  .update(h)
                  .set({
                    stripeCustomerId: S,
                    stripeSubscriptionId: u,
                    stripePriceId: g.items.data[0]?.price.id ?? null,
                    stripeCurrentPeriodEnd: D,
                  })
                  .where(i(h.id, t)),
                _ &&
                  _.monthlyCredits > 0 &&
                  (await T(
                    t,
                    _.monthlyCredits,
                    "subscription_grant",
                    "subscription",
                    u,
                    `${_.name} plan - initial credits`,
                    { periodStart: C, periodEnd: D }
                  ));
            } else if (e.mode === "payment" && e.metadata?.type === "credit_purchase") {
              let d = Number(e.metadata?.credits),
                m = e.metadata?.packageId;
              if (!d || Number.isNaN(d)) break;
              await T(t, d, "purchase", "package", m ?? void 0, "Credit package purchase");
            }
            break;
          }
          case "invoice.paid": {
            let e = p.data.object,
              t = typeof e.customer == "string" ? e.customer : e.customer?.id;
            if (!t) break;
            let [d] = await s.select().from(h).where(i(h.stripeCustomerId, t)).limit(1);
            if (!d) break;
            let m = e.parent?.subscription_details?.subscription,
              u = typeof m == "string" ? m : m?.id,
              g;
            if (u) {
              let [y] = await s
                .select({ id: l.id })
                .from(l)
                .where(i(l.stripeSubscriptionId, u))
                .limit(1);
              g = y?.id;
            }
            let S = {
                userId: d.id,
                subscriptionId: g ?? null,
                stripeInvoiceId: e.id,
                number: e.number ?? null,
                status: "paid",
                subtotal: e.subtotal,
                tax: e.total - e.subtotal,
                total: e.total,
                amountPaid: e.amount_paid,
                amountDue: e.amount_due,
                currency: e.currency,
                periodStart: e.period_start ? new Date(e.period_start * 1e3) : null,
                periodEnd: e.period_end ? new Date(e.period_end * 1e3) : null,
                paidAt: new Date(),
                invoiceUrl: e.hosted_invoice_url ?? null,
                invoicePdfUrl: e.invoice_pdf ?? null,
              },
              [_] = await s.select().from(R).where(i(R.stripeInvoiceId, e.id)).limit(1);
            if (
              (_
                ? await s.update(R).set(S).where(i(R.id, _.id))
                : await s.insert(R).values({ id: F(), ...S }),
              e.billing_reason === "subscription_cycle" && u)
            ) {
              let [y] = await s
                .select({ planId: l.planId })
                .from(l)
                .where(i(l.stripeSubscriptionId, u))
                .limit(1);
              if (y) {
                let [C] = await s.select().from(v).where(i(v.id, y.planId)).limit(1);
                if (C && C.monthlyCredits > 0) {
                  let D = e.period_start ? new Date(e.period_start * 1e3) : new Date(),
                    B = e.period_end ? new Date(e.period_end * 1e3) : new Date();
                  await T(
                    d.id,
                    C.monthlyCredits,
                    "subscription_grant",
                    "invoice",
                    e.id,
                    `${C.name} plan - monthly renewal credits`,
                    { periodStart: D, periodEnd: B }
                  );
                }
              }
            }
            break;
          }
          case "customer.subscription.updated": {
            let e = p.data.object,
              [t] = await s.select().from(l).where(i(l.stripeSubscriptionId, e.id)).limit(1);
            if (!t) break;
            let d = e.items.data[0],
              m = d ? new Date(d.current_period_start * 1e3) : new Date(),
              u = d ? new Date(d.current_period_end * 1e3) : new Date();
            await s
              .update(l)
              .set({
                status: O(e.status),
                currentPeriodStart: m,
                currentPeriodEnd: u,
                cancelAtPeriodEnd: e.cancel_at_period_end,
              })
              .where(i(l.id, t.id)),
              await s.update(h).set({ stripeCurrentPeriodEnd: u }).where(i(h.id, t.userId));
            break;
          }
          case "customer.subscription.deleted": {
            let e = p.data.object,
              [t] = await s.select().from(l).where(i(l.stripeSubscriptionId, e.id)).limit(1);
            if (!t) break;
            await s
              .update(l)
              .set({ status: "canceled", canceledAt: new Date() })
              .where(i(l.id, t.id)),
              await s
                .update(h)
                .set({
                  stripeSubscriptionId: null,
                  stripePriceId: null,
                  stripeCurrentPeriodEnd: null,
                })
                .where(i(h.id, t.userId));
            break;
          }
          default:
            b.warn({ eventType: p.type }, "Unhandled Stripe event type");
        }
      } catch (e) {
        return (
          b.error({ err: e, eventType: p.type }, "Failed to process Stripe webhook event"),
          a.status(500).send({ error: "Webhook processing failed" })
        );
      }
      return { received: !0 };
    }),
    c.addHook("onRequest", async (o) => {
      b.info({ requestId: o.id, method: o.method, url: o.url }, "Incoming request");
    }),
    c.addHook("onResponse", async (o, a) => {
      b.info(
        { requestId: o.id, statusCode: a.statusCode, responseTime: a.elapsedTime },
        "Request completed"
      );
    });
  try {
    await c.listen({ port: w, host: f }), b.info({ port: w, host: f }, "Billing service started");
  } catch (o) {
    b.error(o, "Failed to start server"), process.exit(1);
  }
  let k = ["SIGINT", "SIGTERM"];
  for (let o of k)
    process.on(o, async () => {
      b.info({ signal: o }, "Received shutdown signal"), await c.close(), process.exit(0);
    });
}
z();
