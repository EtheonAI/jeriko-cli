import { stripe } from "@repo/payments";
import { db, users, creditBalances, creditTransactions, eq, sql } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

/**
 * Get or create a Stripe customer for a user.
 * Stores the customer ID in the users table for future lookups.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));

  return customer.id;
}

/**
 * Grant credits to a user and record the transaction.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  type: "subscription_grant" | "purchase" | "refund" | "adjustment" | "bonus",
  referenceType?: string,
  referenceId?: string,
  description?: string,
  periodDates?: { periodStart: Date; periodEnd: Date }
): Promise<void> {
  const [existing] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const currentBalance = existing?.balance ?? 0;
  const newBalance = currentBalance + amount;

  if (existing) {
    const updates: Record<string, unknown> = {
      balance: newBalance,
    };

    if (type === "subscription_grant" && periodDates) {
      // For subscription grants, reset period tracking
      updates.periodCredits = amount;
      updates.periodCreditsUsed = 0;
      updates.periodStart = periodDates.periodStart;
      updates.periodEnd = periodDates.periodEnd;
    } else if (type === "purchase") {
      updates.purchasedCredits = sql`${creditBalances.purchasedCredits} + ${amount}`;
    }

    await db.update(creditBalances).set(updates).where(eq(creditBalances.userId, userId));
  } else {
    const values: Record<string, unknown> = {
      id: createId(),
      userId,
      balance: newBalance,
    };

    if (type === "subscription_grant" && periodDates) {
      values.periodCredits = amount;
      values.periodCreditsUsed = 0;
      values.periodStart = periodDates.periodStart;
      values.periodEnd = periodDates.periodEnd;
    } else if (type === "purchase") {
      values.purchasedCredits = amount;
    }

    await db.insert(creditBalances).values(values as typeof creditBalances.$inferInsert);
  }

  // Record the transaction in the ledger
  await db.insert(creditTransactions).values({
    id: createId(),
    userId,
    type,
    amount,
    balanceAfter: newBalance,
    referenceType,
    referenceId,
    description,
  });
}
