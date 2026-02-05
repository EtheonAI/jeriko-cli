# Database Master Instructions

> **ORM:** Drizzle | **DB:** PostgreSQL (Neon Serverless) | **Schema:** `packages/database/src/schema/`

## IMPORTANT: Schemas Are ALREADY Complete

Unlike what Kimi's instructions said, the Drizzle schema is comprehensive. **Do NOT recreate tables.** The schema files are:

| File                | Tables                                                                                                                           | Lines |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `users.ts`          | users, accounts, authSessions, verifications                                                                                     | 112   |
| `sessions.ts`       | agentSessions, messages                                                                                                          | 68    |
| `agents.ts`         | agents, agentTasks                                                                                                               | 113   |
| `files.ts`          | files, fileVersions                                                                                                              | 74    |
| `billing.ts`        | subscriptionPlans, userSubscriptions, creditPackages, creditBalances, creditTransactions, usageRecords, paymentMethods, invoices | 403   |
| `organizations.ts`  | organizations, members, invitations                                                                                              | 103   |
| `connectors.ts`     | connectorDefinitions, userConnectors, connectorSyncLogs                                                                          | 185   |
| `devices.ts`        | devices, deviceSessions, deviceCommands                                                                                          | 150   |
| `knowledge.ts`      | knowledgeGroups, knowledgeItems, knowledgeChunks, sessionAttachments                                                             | 264   |
| `projects.ts`       | projects, projectMembers, projectSessions, projectFiles, projectGroups                                                           | ~200  |
| `notifications.ts`  | notifications, notificationPreferences                                                                                           | ~120  |
| `scheduledTasks.ts` | scheduledTasks                                                                                                                   | ~80   |
| `sandboxes.ts`      | sandboxes, sandboxExecutions                                                                                                     | ~120  |
| `webhooks.ts`       | webhooks, webhookDeliveries                                                                                                      | ~150  |
| `websites.ts`       | websites, websitePages                                                                                                           | ~100  |

## Complete Table Reference

### Auth & Users

- **users** - id, email, name, image, password, emailVerified, stripeCustomerId, stripeSubscriptionId, stripePriceId, stripeCurrentPeriodEnd
- **accounts** - OAuth provider accounts (Google, GitHub). Fields: userId, accountId, providerId, accessToken, refreshToken
- **authSessions** - Better-Auth sessions with token, expiresAt, ipAddress, userAgent, activeOrganizationId
- **verifications** - Email verification tokens

### AI Agents & Sessions

- **agentSessions** - Chat/task sessions. Fields: userId, title, status (active/paused/completed/failed), metadata
- **messages** - Chat messages. Fields: sessionId, role (user/assistant/system/tool), content, metadata (toolName, toolCallId, model, tokens)
- **agents** - AI agents within sessions. Types: orchestrator, researcher, coder, browser, file_manager, executor, analyst. Fields: sessionId, type, status, currentTask, progress (0-100)
- **agentTasks** - Tasks assigned to agents. Fields: agentId, parentTaskId (for subtasks), title, description, status, priority, result (JSON)

### Billing & Credits

- **subscriptionPlans** - Plan definitions. Types: free/pro/max/enterprise. Fields: priceMonthly/priceYearly (cents), monthlyCredits, features (JSON), limits (JSON), stripePriceIdMonthly/Yearly
- **userSubscriptions** - Active subscriptions. Fields: userId, planId, stripeSubscriptionId, interval (monthly/yearly), status (active/past_due/canceled/trialing/incomplete), currentPeriodStart/End, trial dates, cancellation
- **creditPackages** - One-time credit purchases. Fields: credits, price (cents), bonusCredits, stripePriceId
- **creditBalances** - Per-user credit tracking. Fields: userId, balance, periodCredits, periodCreditsUsed, purchasedCredits, autoTopupEnabled/Threshold/PackageId
- **creditTransactions** - Audit log. Types: subscription_grant/purchase/usage/refund/adjustment/bonus/expiration. Fields: amount, balanceAfter, referenceType/Id
- **usageRecords** - Detailed usage. Types: chat/agent/connector/storage/api. Fields: credits, sessionId, agentId, model, inputTokens, outputTokens
- **paymentMethods** - Stripe payment methods. Fields: stripePaymentMethodId, type (card/paypal/bank), brand, last4, expiryMonth/Year, isDefault
- **invoices** - Invoice records. Fields: stripeInvoiceId, number, status, subtotal/tax/total/amountPaid/amountDue (cents), period dates, invoiceUrl/invoicePdfUrl

### Files

- **files** - Uploaded/generated files. Fields: sessionId, userId, name, path, mimeType, size, storageKey, storageProvider (local/s3/r2/vercel_blob), isPublic
- **fileVersions** - Version control. Fields: fileId, version, storageKey, size, changeDescription

### Organizations

- **organizations** - Multi-tenant. Fields: name, slug, logo
- **members** - Org membership. Fields: userId, organizationId, role (owner/admin/member)
- **invitations** - Org invites. Fields: email, role, status (pending/accepted/rejected/canceled), expiresAt

### Connectors (Composio)

- **connectorDefinitions** - Available connectors. Types: gmail/google_drive/slack/github/notion/linear/jira etc. Fields: type, name, category (communication/storage/productivity/development/crm/analytics), authType (oauth2/api_key/basic/custom), oauthConfig
- **userConnectors** - User's connected apps. Fields: userId, connectorDefinitionId, status (connected/disconnected/error/pending/syncing), tokens, syncEnabled, syncInterval, lastSyncAt
- **connectorSyncLogs** - Sync history. Fields: userConnectorId, status, itemsSynced, itemsFailed

### Devices

- **devices** - Controlled devices. Types: browser/desktop/mobile/server. Fields: userId, name, type, status (online/offline/busy/error), connectionId, lastHeartbeat, capabilities, config, browserType/Version/viewport
- **deviceSessions** - Active control sessions. Fields: deviceId, agentSessionId, status (active/paused/ended), currentUrl, currentTitle, screenshot
- **deviceCommands** - Commands sent. Fields: deviceId, type, payload, status (pending/executing/completed/failed), result, error, retryCount, maxRetries

### Knowledge (RAG)

- **knowledgeGroups** - Folders/collections. Fields: userId, parentId, name, sortOrder, isShared, shareSettings
- **knowledgeItems** - Documents/files/webpages/notes. Fields: type, name, content, sourceUrl, mimeType, storageKey, status (processing/ready/failed/archived), embeddingId/Model, tags
- **knowledgeChunks** - For RAG chunking. Fields: itemId, content, chunkIndex, startOffset/endOffset, pageNumber, embeddingId
- **sessionAttachments** - Files attached to chat. Fields: sessionId, knowledgeItemId, name, mimeType, storageKey, status (uploading/processing/ready/failed)

## How to Use in Code

### In tRPC routers (apps/app/lib/trpc/routers/)

```typescript
import { db, users, eq, and, desc, sql } from "@repo/database";
// db is already configured with Neon serverless
```

### In backend services (services/\*/src/)

```typescript
import { db, tableName, eq } from "@repo/database";
// Same db instance, same query API
```

### Common Query Patterns

```typescript
// Select with filter
const items = await db.select().from(table).where(eq(table.userId, userId));

// Join
const result = await db
  .select({ sub: userSubscriptions, plan: subscriptionPlans })
  .from(userSubscriptions)
  .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
  .where(eq(userSubscriptions.userId, userId));

// Insert
const [item] = await db
  .insert(table)
  .values({ ...data })
  .returning();

// Update
const [updated] = await db
  .update(table)
  .set({ ...changes })
  .where(eq(table.id, id))
  .returning();

// Delete
await db.delete(table).where(eq(table.id, id));

// Aggregation
const summary = await db
  .select({ type: usageRecords.type, total: sql<number>`sum(${usageRecords.credits})` })
  .from(usageRecords)
  .groupBy(usageRecords.type);
```

## Migration Commands

```bash
pnpm --filter @repo/database drizzle-kit push    # Push schema to DB
pnpm --filter @repo/database drizzle-kit generate # Generate migration files
pnpm --filter @repo/database drizzle-kit migrate  # Run migrations
pnpm --filter @repo/database drizzle-kit studio   # Open Drizzle Studio UI
```

## Seed Data Needed

Create `packages/database/src/seed.ts`:

1. **Subscription Plans** - Free (0/mo, 100 credits), Pro ($20/mo, 2000 credits), Max ($50/mo, 10000 credits), Enterprise (custom)
2. **Credit Packages** - Starter (100 credits/$10), Growth (500/$40), Power (2000/$120)
3. **Connector Definitions** - Gmail, Google Drive, Slack, GitHub, Notion, Linear, Jira, Confluence, Dropbox, OneDrive (with icons, categories, authType)

## Note on Prisma

There's a legacy `packages/database/prisma/schema.prisma` with only 5 models. **IGNORE IT.** Use Drizzle exclusively. The Prisma schema is outdated and should be removed.
