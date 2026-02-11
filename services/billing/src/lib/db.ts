import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export let db: any;
export let users: any;
export let subscriptionPlans: any;
export let userSubscriptions: any;
export let creditPackages: any;
export let creditBalances: any;
export let creditTransactions: any;
export let usageRecords: any;
export let usageLedger: any;
export let paymentMethods: any;
export let invoices: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  users = resolved.users;
  subscriptionPlans = resolved.subscriptionPlans;
  userSubscriptions = resolved.userSubscriptions;
  creditPackages = resolved.creditPackages;
  creditBalances = resolved.creditBalances;
  creditTransactions = resolved.creditTransactions;
  usageRecords = resolved.usageRecords;
  usageLedger = resolved.usageLedger;
  paymentMethods = resolved.paymentMethods;
  invoices = resolved.invoices;
}

export { eq, and, desc, sql, gte, lte };
