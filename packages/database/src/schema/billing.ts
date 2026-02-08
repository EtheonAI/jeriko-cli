import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

/**
 * Billing Schema
 * Subscriptions, credits, invoices, and usage tracking
 */

export type PlanType = "free" | "pro" | "max" | "enterprise";
export type BillingInterval = "monthly" | "yearly";
export type PaymentStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "trialing"
  | "incomplete";
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";

// Subscription Plans (plan definitions)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["free", "pro", "max", "enterprise"],
  }).notNull(),
  description: text("description"),
  // Pricing
  priceMonthly: integer("price_monthly").default(0).notNull(), // in cents
  priceYearly: integer("price_yearly").default(0).notNull(),
  discountYearlyPercent: integer("discount_yearly_percent").default(0),
  // Credits
  monthlyCredits: integer("monthly_credits").default(0).notNull(),
  // Features
  features: jsonb("features").$type<string[]>(),
  limits: jsonb("limits").$type<{
    maxSessions?: number;
    maxAgents?: number;
    maxStorage?: number; // in MB
    maxTeamMembers?: number;
    maxProjects?: number;
    [key: string]: unknown;
  }>(),
  // Stripe
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  stripeProductId: text("stripe_product_id"),
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isPopular: boolean("is_popular").default(false).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// User Subscriptions
export const userSubscriptions = pgTable("user_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  planId: text("plan_id")
    .notNull()
    .references(() => subscriptionPlans.id),
  // Stripe
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  // Billing details
  interval: text("interval", {
    enum: ["monthly", "yearly"],
  })
    .default("monthly")
    .notNull(),
  status: text("status", {
    enum: ["active", "past_due", "canceled", "trialing", "incomplete"],
  })
    .default("active")
    .notNull(),
  // Period
  currentPeriodStart: timestamp("current_period_start", {
    mode: "date",
  }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }).notNull(),
  // Trial
  trialStart: timestamp("trial_start", { mode: "date" }),
  trialEnd: timestamp("trial_end", { mode: "date" }),
  // Cancellation
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  canceledAt: timestamp("canceled_at", { mode: "date" }),
  cancellationReason: text("cancellation_reason"),
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userSubscriptionsRelations = relations(
  userSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userSubscriptions.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [userSubscriptions.organizationId],
      references: [organizations.id],
    }),
    plan: one(subscriptionPlans, {
      fields: [userSubscriptions.planId],
      references: [subscriptionPlans.id],
    }),
  })
);

// Credit Packages (for one-time credit purchases)
export const creditPackages = pgTable("credit_packages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  credits: integer("credits").notNull(),
  price: integer("price").notNull(), // in cents
  currency: text("currency").default("usd").notNull(),
  // Bonus credits
  bonusCredits: integer("bonus_credits").default(0),
  // Stripe
  stripePriceId: text("stripe_price_id"),
  stripeProductId: text("stripe_product_id"),
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isPopular: boolean("is_popular").default(false).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Credit Balances
export const creditBalances = pgTable("credit_balances", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  // Balance
  balance: integer("balance").default(0).notNull(),
  // Period tracking
  periodCredits: integer("period_credits").default(0).notNull(), // Credits from subscription
  periodCreditsUsed: integer("period_credits_used").default(0).notNull(),
  periodStart: timestamp("period_start", { mode: "date" }),
  periodEnd: timestamp("period_end", { mode: "date" }),
  // Purchased credits
  purchasedCredits: integer("purchased_credits").default(0).notNull(),
  // Auto top-up
  autoTopupEnabled: boolean("auto_topup_enabled").default(false).notNull(),
  autoTopupThreshold: integer("auto_topup_threshold"),
  autoTopupPackageId: text("auto_topup_package_id").references(
    () => creditPackages.id
  ),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
  user: one(users, {
    fields: [creditBalances.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [creditBalances.organizationId],
    references: [organizations.id],
  }),
  autoTopupPackage: one(creditPackages, {
    fields: [creditBalances.autoTopupPackageId],
    references: [creditPackages.id],
  }),
}));

// Credit Transactions
export const creditTransactions = pgTable("credit_transactions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  // Transaction details
  type: text("type", {
    enum: [
      "subscription_grant",
      "purchase",
      "usage",
      "refund",
      "adjustment",
      "bonus",
      "expiration",
    ],
  }).notNull(),
  amount: integer("amount").notNull(), // positive for credit, negative for debit
  balanceAfter: integer("balance_after").notNull(),
  // Reference
  referenceType: text("reference_type"), // e.g., "session", "invoice", "package"
  referenceId: text("reference_id"),
  // Description
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [creditTransactions.organizationId],
      references: [organizations.id],
    }),
  })
);

// Usage Records (for detailed usage tracking)
export const usageRecords = pgTable("usage_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  // Usage details
  type: text("type", {
    enum: ["chat", "agent", "connector", "storage", "api"],
  }).notNull(),
  credits: integer("credits").notNull(),
  // Reference
  sessionId: text("session_id"),
  agentId: text("agent_id"),
  // Model usage (for AI calls)
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  // Description
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [usageRecords.organizationId],
    references: [organizations.id],
  }),
}));

// Payment Methods
export const paymentMethods = pgTable("payment_methods", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Stripe
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  // Card details (from Stripe)
  type: text("type", {
    enum: ["card", "paypal", "bank"],
  }).notNull(),
  brand: text("brand"), // visa, mastercard, etc.
  last4: text("last4"),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  // Default
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [paymentMethods.userId],
    references: [users.id],
  }),
}));

// Invoices
export const invoices = pgTable("invoices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  subscriptionId: text("subscription_id").references(
    () => userSubscriptions.id
  ),
  // Stripe
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  // Invoice details
  number: text("number"),
  status: text("status", {
    enum: ["draft", "open", "paid", "void", "uncollectible"],
  }).notNull(),
  // Amounts (in cents)
  subtotal: integer("subtotal").notNull(),
  tax: integer("tax").default(0),
  total: integer("total").notNull(),
  amountPaid: integer("amount_paid").default(0),
  amountDue: integer("amount_due").notNull(),
  currency: text("currency").default("usd").notNull(),
  // Dates
  periodStart: timestamp("period_start", { mode: "date" }),
  periodEnd: timestamp("period_end", { mode: "date" }),
  dueDate: timestamp("due_date", { mode: "date" }),
  paidAt: timestamp("paid_at", { mode: "date" }),
  // URLs
  invoiceUrl: text("invoice_url"),
  invoicePdfUrl: text("invoice_pdf_url"),
  // Description
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [invoices.organizationId],
    references: [organizations.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [invoices.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

// Export types
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type NewCreditPackage = typeof creditPackages.$inferInsert;
export type CreditBalance = typeof creditBalances.$inferSelect;
export type NewCreditBalance = typeof creditBalances.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
