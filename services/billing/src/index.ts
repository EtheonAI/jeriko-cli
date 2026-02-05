import Fastify from "fastify";
import { createLogger, getEnv, createId } from "@repo/service-utils";
import {
  db,
  subscriptionPlans,
  userSubscriptions,
  creditPackages,
  creditBalances,
  creditTransactions,
  usageRecords,
  eq,
  and,
  desc,
  sql,
  gte,
  lte,
} from "@repo/database";

const logger = createLogger({ service: "billing" });

async function main() {
  const port = parseInt(getEnv("PORT", "4008"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "billing" };
  });

  // Get subscription plans
  app.get("/plans", async (request, reply) => {
    try {
      const plans = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(subscriptionPlans.sortOrder);
      return { plans };
    } catch (error) {
      logger.error(error, "Failed to fetch plans");
      return reply.status(500).send({ error: "Failed to fetch plans" });
    }
  });

  // Get user subscription
  app.get("/users/:userId/subscription", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
      if (!subscription) {
        return { userId, plan: "free", status: "active" };
      }
      return subscription;
    } catch (error) {
      logger.error(error, "Failed to fetch subscription");
      return reply.status(500).send({ error: "Failed to fetch subscription" });
    }
  });

  // Create subscription
  app.post("/subscriptions", async (request, reply) => {
    const { userId, planId, paymentMethodId } = request.body as {
      userId: string;
      planId: string;
      paymentMethodId?: string;
    };

    try {
      // TODO: Stripe subscription creation
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [subscription] = await db
        .insert(userSubscriptions)
        .values({
          id: createId(),
          userId,
          planId,
          status: "active",
          interval: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .returning();

      return { id: subscription!.id, userId, planId, status: "active" };
    } catch (error) {
      logger.error(error, "Failed to create subscription");
      return reply.status(500).send({ error: "Failed to create subscription" });
    }
  });

  // Cancel subscription
  app.post("/subscriptions/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      // TODO: Cancel in Stripe
      const [updated] = await db
        .update(userSubscriptions)
        .set({
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
        })
        .where(eq(userSubscriptions.id, id))
        .returning();
      if (!updated) {
        return reply.status(404).send({ error: "Subscription not found" });
      }
      return { id: updated.id, status: "cancelled" };
    } catch (error) {
      logger.error(error, "Failed to cancel subscription");
      return reply.status(500).send({ error: "Failed to cancel subscription" });
    }
  });

  // Get credit balance
  app.get("/users/:userId/credits", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const [balance] = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);
      if (!balance) {
        return { userId, balance: 0, used: 0 };
      }
      return { userId, balance: balance.balance, used: balance.periodCreditsUsed };
    } catch (error) {
      logger.error(error, "Failed to fetch credit balance");
      return reply.status(500).send({ error: "Failed to fetch credit balance" });
    }
  });

  // Purchase credits
  app.post("/credits/purchase", async (request, reply) => {
    const { userId, packageId, paymentMethodId } = request.body as {
      userId: string;
      packageId: string;
      paymentMethodId: string;
    };

    try {
      // TODO: Process payment via Stripe
      const [pkg] = await db
        .select()
        .from(creditPackages)
        .where(eq(creditPackages.id, packageId))
        .limit(1);
      if (!pkg) {
        return reply.status(404).send({ error: "Credit package not found" });
      }

      const creditsToAdd = pkg.credits + (pkg.bonusCredits || 0);

      const [existing] = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);

      let newBalance: number;
      if (existing) {
        newBalance = existing.balance + creditsToAdd;
        await db
          .update(creditBalances)
          .set({
            balance: newBalance,
            purchasedCredits: existing.purchasedCredits + creditsToAdd,
          })
          .where(eq(creditBalances.userId, userId));
      } else {
        newBalance = creditsToAdd;
        await db.insert(creditBalances).values({
          id: createId(),
          userId,
          balance: newBalance,
          purchasedCredits: creditsToAdd,
        });
      }

      const [transaction] = await db
        .insert(creditTransactions)
        .values({
          id: createId(),
          userId,
          type: "purchase",
          amount: creditsToAdd,
          balanceAfter: newBalance,
          referenceType: "package",
          referenceId: packageId,
          description: `Purchased ${pkg.name}`,
        })
        .returning();

      return { transactionId: transaction!.id, credits: creditsToAdd, status: "completed" };
    } catch (error) {
      logger.error(error, "Failed to purchase credits");
      return reply.status(500).send({ error: "Failed to purchase credits" });
    }
  });

  // Record usage
  app.post("/usage", async (request, reply) => {
    const { userId, type, amount, metadata } = request.body as {
      userId: string;
      type: string;
      amount: number;
      metadata?: Record<string, unknown>;
    };

    try {
      const [record] = await db
        .insert(usageRecords)
        .values({
          id: createId(),
          userId,
          type: type as any,
          credits: amount,
          metadata,
        })
        .returning();

      // Deduct from balance
      await db
        .update(creditBalances)
        .set({
          balance: sql`${creditBalances.balance} - ${amount}`,
          periodCreditsUsed: sql`${creditBalances.periodCreditsUsed} + ${amount}`,
        })
        .where(eq(creditBalances.userId, userId));

      return { id: record!.id, recorded: true };
    } catch (error) {
      logger.error(error, "Failed to record usage");
      return reply.status(500).send({ error: "Failed to record usage" });
    }
  });

  // Get usage history
  app.get("/users/:userId/usage", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { from, to, type } = request.query as {
      from?: string;
      to?: string;
      type?: string;
    };

    try {
      const conditions = [eq(usageRecords.userId, userId)];
      if (from) {
        conditions.push(gte(usageRecords.createdAt, new Date(from)));
      }
      if (to) {
        conditions.push(lte(usageRecords.createdAt, new Date(to)));
      }
      if (type) {
        conditions.push(eq(usageRecords.type, type as any));
      }

      const records = await db
        .select()
        .from(usageRecords)
        .where(and(...conditions))
        .orderBy(desc(usageRecords.createdAt))
        .limit(100);

      return { usage: records, total: records.length };
    } catch (error) {
      logger.error(error, "Failed to fetch usage history");
      return reply.status(500).send({ error: "Failed to fetch usage history" });
    }
  });

  // Stripe webhook handler
  app.post("/webhooks/stripe", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    // TODO: Verify Stripe signature and process webhook
    logger.info("Stripe webhook received");
    return { received: true };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Billing service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
