# Settings Modal - Build Instructions

## Current State

### Settings Infrastructure

The settings system is a modal dialog with a left sidebar navigation and content area.

**Settings Dialog** (`apps/app/app/(authenticated)/components/settings/settings-dialog.tsx`, 51 lines):

- Uses `Dialog`/`DialogContent` from `@repo/design-system`
- Max width 4xl, height 600px, max-height 90vh
- Left sidebar: 220px width with `SettingsNav`
- Right content area with `SettingsContent`
- Rounded corners (20px), no padding, overflow hidden

**Settings Navigation** (`apps/app/app/(authenticated)/components/settings/settings-nav.tsx`, 71 lines):

- 13 nav items with icons from lucide-react:
  1. Account (UserIcon)
  2. Settings (SettingsIcon)
  3. Usage (ZapIcon)
  4. Billing (CreditCardIcon)
  5. Scheduled tasks (CalendarIcon)
  6. Devices (MonitorIcon)
  7. Connectors (PlugIcon)
  8. Mail Manus (MailIcon)
  9. Data controls (DatabaseIcon)
  10. Personalization (PaletteIcon)
  11. Skills (SparklesIcon)
  12. Integrations (LinkIcon)
  13. Get help (HelpCircleIcon)
- Active tab highlighted with `bg-accent text-accent-foreground`

**Settings Context** (`apps/app/app/(authenticated)/components/settings/settings-context.tsx`):

- `SettingsTab` type with all 13 tab IDs
- `SettingsProvider` with `activeTab`, `setActiveTab`, `isOpen`, `openSettings`, `closeSettings`

**Settings Content** (`apps/app/app/(authenticated)/components/settings/settings-content.tsx`, 112 lines):

- Switch statement routing to tab components
- Each tab has a `title` and `description` in `tabConfig`
- Falls back to `PlaceholderTab` for unimplemented tabs

### Implemented Tabs

#### Account Tab (`tabs/account-tab.tsx`, 365 lines) - FULLY IMPLEMENTED

- Profile section: Avatar upload (with 2MB limit, JPG/PNG/GIF), name field, email (read-only)
- Password section: Current password, new password, confirm password (Zod validation)
- Danger zone: Delete account with "DELETE" confirmation dialog
- Uses tRPC mutations: `user.updateProfile`, `user.changePassword`, `user.deleteAccount`
- Form handling via `react-hook-form` with `@hookform/resolvers/zod`
- Toast notifications via `sonner`

#### Billing Tab (`tabs/billing-tab.tsx`, 506 lines) - FULLY IMPLEMENTED

- Current plan display with Crown icon, status badge, renewal date
- Available plans grid (from `billing.listPlans`) with price, features, Popular badge
- Payment methods list with default badge, set default, remove actions
- Billing history table with date, description, amount, status
- Cancel/Reactivate subscription flow with reason input
- Stripe billing portal integration (has TODOs in backend)
- Uses tRPC queries: `billing.listPlans`, `billing.getSubscription`, `billing.listPaymentMethods`, `billing.listInvoices`, `billing.listCreditPackages`
- Uses tRPC mutations: `billing.createSubscriptionCheckout`, `billing.cancelSubscription`, `billing.reactivateSubscription`, `billing.setDefaultPaymentMethod`, `billing.deletePaymentMethod`, `billing.getBillingPortalUrl`

### Partially Implemented / Placeholder Tabs

The following tabs exist as files but need real implementation:

| Tab File                       | Current State                          |
| ------------------------------ | -------------------------------------- |
| `tabs/usage-tab.tsx`           | Exists, needs credit usage charts      |
| `tabs/connectors-tab.tsx`      | Exists, needs connector list           |
| `tabs/devices-tab.tsx`         | Exists, needs device list              |
| `tabs/personalization-tab.tsx` | Exists, needs theme/language settings  |
| `tabs/scheduled-tasks-tab.tsx` | Exists, needs task list                |
| `tabs/data-controls-tab.tsx`   | Exists, needs export/privacy settings  |
| `tabs/skills-tab.tsx`          | Exists, needs AI capability config     |
| `tabs/mail-manus-tab.tsx`      | Exists, needs email integration config |
| `tabs/integrations-tab.tsx`    | Exists, needs webhook/API settings     |
| `tabs/help-tab.tsx`            | Exists, needs docs/support links       |
| `tabs/settings-tab.tsx`        | Exists, needs general preferences      |
| `tabs/placeholder-tab.tsx`     | Generic placeholder component          |
| `tabs/error-state.tsx`         | Reusable error state with retry button |

---

## What Needs Building Per Tab

### 1. Account Tab - ENHANCEMENTS NEEDED

Already implemented with profile, password, and delete. Add:

- **Two-Factor Authentication (2FA)**:

  - Enable/disable 2FA toggle
  - QR code display for authenticator app setup (via `@repo/auth` which uses Better-Auth)
  - Recovery codes display and download
  - Better-Auth has 2FA support via `twoFactor` plugin

- **Active Sessions**:
  - List of active sessions (browser, device, location, last active)
  - "Sign out" button per session
  - "Sign out all other sessions" button
  - Wire to Better-Auth session management

**Files to modify:**

- `tabs/account-tab.tsx` - Add 2FA and sessions sections
- `apps/app/lib/trpc/routers/user.router.ts` - Add 2FA and session procedures

### 2. Billing Tab - ENHANCEMENTS NEEDED

Already implemented with plans, payments, invoices. Add:

- **Credit Balance Display**:

  - Large credit balance number with progress bar (used/total for period)
  - Wire to `billing.getCreditBalance` (already exists in router)
  - Auto-top-up settings: enable/disable, threshold, package selection
  - Wire to `billing.updateAutoTopup` (already exists)

- **Credit Packages**:

  - Grid of purchasable credit packages
  - Wire to `billing.listCreditPackages` (already exists) and `billing.createCreditPurchaseCheckout` (exists with Stripe TODO)

- **Stripe Checkout Integration**:
  - Complete the TODO in `billing.router.ts` `createSubscriptionCheckout` (line 400-408)
  - Complete the TODO in `billing.router.ts` `createCreditPurchaseCheckout` (line 434-440)
  - Import `stripe` from `@repo/payments` and create Stripe checkout sessions
  - Pattern: `const { stripe } = await import("@repo/payments"); const session = await stripe.checkout.sessions.create({...})`

**Files to modify:**

- `tabs/billing-tab.tsx` - Add credit balance and packages sections
- `apps/app/lib/trpc/routers/billing.router.ts` - Complete Stripe TODOs (lines 400-408, 434-440, 464-467, 524-528)

### 3. Connectors Tab

Compact version of the Applications page, showing connected apps within settings context.

**Build:**

- List of connected connectors with status badges (from `connectors.list` query)
- Quick actions per connector: Sync Now, Disconnect, Configure
- "Browse more" link that navigates to `/applications` page
- Sync status indicator and last synced time
- Error state with re-authenticate button for expired tokens

**Wire to:** `apps/app/lib/trpc/routers/connectors.router.ts` - `list`, `disconnect`, `sync`

**File:** `tabs/connectors-tab.tsx`

### 4. Devices Tab

Compact version of the Devices page within settings.

**Build:**

- List of registered devices with online/offline status
- Current device highlighted
- Quick actions: rename, remove
- "Manage devices" link to `/devices` page
- Last active timestamp per device

**Wire to:** `apps/app/lib/trpc/routers/devices.router.ts` - `list`, `update`, `unregister`

**File:** `tabs/devices-tab.tsx`

### 5. Personalization Tab

**Build:**

- **Theme**: Radio group - Light / Dark / System. Store in localStorage and apply via `next-themes` or CSS variables.
- **Language**: Dropdown selector. Wire to `packages/internationalization/` which already exists.
- **AI Response Style**: Dropdown - Concise / Balanced / Detailed. Store in user preferences.
- **AI Tone**: Dropdown - Professional / Friendly / Casual. Store in user preferences.
- **Font Size**: Slider or dropdown (Small / Medium / Large). Apply via CSS custom property.
- **Sidebar Position**: Left / Right toggle.
- **Default Model**: Dropdown of available models (from `packages/ai/lib/providers/`).

**Store preferences:** Add `preferences` jsonb field to user table, or create new `userPreferences` table. Alternatively use `user.router.ts` `updateProfile` mutation.

**File:** `tabs/personalization-tab.tsx`

### 6. Scheduled Tasks Tab

Compact task management within settings.

**Build:**

- Table of scheduled tasks with columns: Name, Schedule, Status, Next Run, Actions
- Enable/disable toggle per task
- Inline cron expression display with human-readable tooltip
- Quick actions: Edit, Pause/Resume, Delete, Run Now
- "Create new task" button that opens schedule builder dialog
- "View all" link to `/actions?tab=schedules`

**Wire to:** `apps/app/lib/trpc/routers/scheduledTasks.router.ts` - `list`, `update`, `pause`, `resume`, `delete`, `runNow`

**File:** `tabs/scheduled-tasks-tab.tsx`

### 7. Data Controls Tab

**Build:**

- **Export All Data**:

  - "Export my data" button
  - Generates ZIP containing: messages, files list, settings, connectors config
  - Download link (or email when ready)
  - Add `exportData` mutation to `user.router.ts`

- **Delete Account**:

  - Move from Account tab or duplicate here
  - Show what will be deleted: X messages, Y files, Z connectors
  - Require email confirmation + "DELETE" text confirmation

- **Privacy Settings**:

  - "Allow analytics" toggle
  - "Allow usage data for model improvement" toggle
  - "Clear chat history" button with confirmation
  - "Clear all files" button with confirmation

- **Data Retention**:
  - Auto-delete messages older than: Never / 30 days / 90 days / 1 year
  - Auto-delete files older than: Never / 30 days / 90 days / 1 year

**File:** `tabs/data-controls-tab.tsx`

### 8. Usage Tab

**Build:**

- **Credit Usage Summary** (current period):

  - Total credits used / Total available (progress bar)
  - Period dates (from `billing.getUsageSummary`)

- **Usage by Type** (pie chart):

  - Chat, Agent, Connector, Storage, API
  - Wire to `billing.getUsageSummary` which returns `byType` breakdown

- **Daily Usage Chart** (bar chart):

  - Last 30 days of credit usage
  - Wire to `billing.getUsageRecords` with date range

- **Usage Table**:

  - Detailed table of recent usage records
  - Columns: Date, Type, Description, Credits, Model
  - Wire to `billing.getUsageRecords`
  - Filter by type dropdown

- **Charts**: Use Recharts (already common in Next.js projects) for bar and pie charts.

**File:** `tabs/usage-tab.tsx`

### 9. Skills Tab

**Build:**

- List of AI capabilities/tools that can be enabled/disabled
- Categories: Web Search, Code Execution, File Operations, Data Analysis, Image Generation
- Toggle per skill with description
- Some skills may require connected apps (e.g., "GitHub Actions" requires GitHub connector)
- Link skills to tool registry in `packages/ai/lib/tools/tool-registry.ts`

**File:** `tabs/skills-tab.tsx`

### 10. Mail Tab

**Build:**

- Email integration configuration
- Connect email accounts (Gmail, Outlook) via OAuth
- Email processing preferences: auto-summarize, auto-categorize
- Email templates for AI-generated responses

**File:** `tabs/mail-manus-tab.tsx`

### 11. Integrations Tab

**Build:**

- Webhook management via Svix (`packages/webhooks/`)
- API key management (create, revoke, list)
- Webhook event type selector
- Webhook delivery logs
- Svix app portal embed (using `getAppPortal()` from `packages/webhooks/lib/svix.ts`)

**File:** `tabs/integrations-tab.tsx`

### 12. Help Tab

**Build:**

- Links to documentation
- Contact support form
- FAQ accordion
- Keyboard shortcuts reference
- Version info
- Status page link

**File:** `tabs/help-tab.tsx`

### 13. General Settings Tab

**Build:**

- Notification preferences: Email, Push, In-app toggles per event type
- Keyboard shortcut customization
- Default session settings (model, temperature, max tokens)
- Auto-save preferences

**File:** `tabs/settings-tab.tsx`

---

## Key File Paths

| Purpose                | Path                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| Settings dialog        | `apps/app/app/(authenticated)/components/settings/settings-dialog.tsx`          |
| Settings content       | `apps/app/app/(authenticated)/components/settings/settings-content.tsx`         |
| Settings nav           | `apps/app/app/(authenticated)/components/settings/settings-nav.tsx`             |
| Settings context       | `apps/app/app/(authenticated)/components/settings/settings-context.tsx`         |
| Account tab            | `apps/app/app/(authenticated)/components/settings/tabs/account-tab.tsx`         |
| Billing tab            | `apps/app/app/(authenticated)/components/settings/tabs/billing-tab.tsx`         |
| Usage tab              | `apps/app/app/(authenticated)/components/settings/tabs/usage-tab.tsx`           |
| Connectors tab         | `apps/app/app/(authenticated)/components/settings/tabs/connectors-tab.tsx`      |
| Devices tab            | `apps/app/app/(authenticated)/components/settings/tabs/devices-tab.tsx`         |
| Personalization tab    | `apps/app/app/(authenticated)/components/settings/tabs/personalization-tab.tsx` |
| Scheduled tasks tab    | `apps/app/app/(authenticated)/components/settings/tabs/scheduled-tasks-tab.tsx` |
| Data controls tab      | `apps/app/app/(authenticated)/components/settings/tabs/data-controls-tab.tsx`   |
| Skills tab             | `apps/app/app/(authenticated)/components/settings/tabs/skills-tab.tsx`          |
| Mail tab               | `apps/app/app/(authenticated)/components/settings/tabs/mail-manus-tab.tsx`      |
| Integrations tab       | `apps/app/app/(authenticated)/components/settings/tabs/integrations-tab.tsx`    |
| Help tab               | `apps/app/app/(authenticated)/components/settings/tabs/help-tab.tsx`            |
| General settings tab   | `apps/app/app/(authenticated)/components/settings/tabs/settings-tab.tsx`        |
| Placeholder tab        | `apps/app/app/(authenticated)/components/settings/tabs/placeholder-tab.tsx`     |
| Error state            | `apps/app/app/(authenticated)/components/settings/tabs/error-state.tsx`         |
| Billing router         | `apps/app/lib/trpc/routers/billing.router.ts`                                   |
| User router            | `apps/app/lib/trpc/routers/user.router.ts`                                      |
| Connectors router      | `apps/app/lib/trpc/routers/connectors.router.ts`                                |
| Devices router         | `apps/app/lib/trpc/routers/devices.router.ts`                                   |
| Scheduled tasks router | `apps/app/lib/trpc/routers/scheduledTasks.router.ts`                            |
| Webhooks package       | `packages/webhooks/index.ts`                                                    |
| Svix implementation    | `packages/webhooks/lib/svix.ts`                                                 |
| Auth package           | `packages/auth/`                                                                |
| Payments package       | `packages/payments/index.ts`                                                    |
| Design system          | `packages/design-system/`                                                       |

## Shared Patterns

All settings tabs should follow this structure:

```tsx
export function ExampleTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Tab Title</h2>
        <p className="text-sm text-muted-foreground">Tab description.</p>
      </div>
      <Separator />
      {/* Content sections */}
    </div>
  );
}
```

Use the `ErrorState` component (`tabs/error-state.tsx`) for error handling. Use `Skeleton` from design system for loading states. Use `toast` from `sonner` for success/error notifications.

## Priority Order

1. Usage tab (users need to see credit consumption)
2. Billing tab Stripe integration (complete TODOs in billing.router.ts)
3. Personalization tab (theme, language, AI preferences)
4. Data controls tab (export data, privacy settings)
5. Scheduled tasks tab (compact task management)
6. Connectors tab (connected apps management)
7. Devices tab (device list)
8. Account tab 2FA and sessions
9. Skills tab (AI capability toggles)
10. Integrations tab (webhooks, API keys)
11. General settings tab (notifications)
12. Mail tab
13. Help tab
