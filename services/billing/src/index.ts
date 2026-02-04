import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

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
    // TODO: Fetch from database
    return {
      plans: [
        { id: "free", name: "Free", price: 0, credits: 100 },
        { id: "pro", name: "Pro", price: 29, credits: 1000 },
        { id: "enterprise", name: "Enterprise", price: 99, credits: 10000 },
      ],
    };
  });

  // Get user subscription
  app.get("/users/:userId/subscription", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // TODO: Fetch from database
    return { userId, plan: "free", status: "active" };
  });

  // Create subscription
  app.post("/subscriptions", async (request, reply) => {
    const { userId, planId, paymentMethodId } = request.body as {
      userId: string;
      planId: string;
      paymentMethodId?: string;
    };

    // TODO: Create Stripe subscription and save to database
    const subscriptionId = crypto.randomUUID();

    return { id: subscriptionId, userId, planId, status: "active" };
  });

  // Cancel subscription
  app.post("/subscriptions/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Cancel in Stripe and update database
    return { id, status: "cancelled" };
  });

  // Get credit balance
  app.get("/users/:userId/credits", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // TODO: Fetch from database
    return { userId, balance: 100, used: 0 };
  });

  // Purchase credits
  app.post("/credits/purchase", async (request, reply) => {
    const { userId, packageId, paymentMethodId } = request.body as {
      userId: string;
      packageId: string;
      paymentMethodId: string;
    };

    // TODO: Process payment and add credits
    const transactionId = crypto.randomUUID();

    return { transactionId, credits: 500, status: "completed" };
  });

  // Record usage
  app.post("/usage", async (request, reply) => {
    const { userId, type, amount, metadata } = request.body as {
      userId: string;
      type: string;
      amount: number;
      metadata?: Record<string, unknown>;
    };

    // TODO: Record usage and deduct credits
    const usageId = crypto.randomUUID();

    return { id: usageId, recorded: true };
  });

  // Get usage history
  app.get("/users/:userId/usage", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { from, to, type } = request.query as {
      from?: string;
      to?: string;
      type?: string;
    };

    // TODO: Fetch from database
    return { usage: [], total: 0 };
  });

  // Stripe webhook handler
  app.post("/webhooks/stripe", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    // TODO: Verify signature and process webhook
    logger.info("Stripe webhook received");
    return { received: true };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
    }, "Incoming request");
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info({
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "Request completed");
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
