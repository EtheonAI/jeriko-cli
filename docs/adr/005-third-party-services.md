# ADR-005: Third-Party Service Evaluation and Selection

**Status:** Proposed
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Evaluating third-party services for notifications, webhooks, integrations, workflows, and sandboxing

---

## Context and Problem Statement

Rubic uses several third-party services inherited from the next-forge boilerplate. We need to evaluate whether these services are optimal for our use case and identify additional services needed for the backend microservices architecture.

**Current Services (from next-forge):**
- Knock (notifications)
- Svix (webhooks)
- Stripe (payments)
- Resend (email)
- PostHog (analytics)
- Sentry (error tracking)
- LiveBlocks (collaboration)

**Additional Services to Evaluate:**
- Composio (AI tool integrations)
- Inngest (workflow orchestration)
- E2B (code sandboxing)

---

## Evaluation Framework

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Functionality** | 25% | Does it solve our problem completely? |
| **AWS Compatibility** | 20% | Works well with AWS infrastructure |
| **Pricing** | 20% | Cost-effective at scale |
| **Developer Experience** | 15% | SDK quality, documentation |
| **Reliability** | 10% | Uptime, support |
| **Lock-in Risk** | 10% | Migration difficulty |

---

## Service-by-Service Evaluation

### 1. Notifications: Knock

**Current Status:** KEEP

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 9/10 | Multi-channel (push, email, SMS, in-app), preferences, batching |
| AWS Compatibility | 8/10 | API-based, no AWS-specific requirements |
| Pricing | 8/10 | Free tier: 10K notifications/month; Pro starts $99/month |
| Developer Experience | 9/10 | Excellent React SDK, type-safe |
| Reliability | 9/10 | 99.99% SLA on Pro |
| Lock-in Risk | 6/10 | Proprietary, but notification abstraction layer possible |

**Alternatives Considered:**
- **AWS SNS + SES:** Lower cost but much more development work
- **Novu:** Open-source alternative, less polished
- **Custom:** High development cost for features we need

**Decision:** Keep Knock. Best-in-class notification infrastructure with excellent DX.

---

### 2. Webhooks: Svix

**Current Status:** KEEP

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 9/10 | Delivery guarantees, retries, signature verification, logs |
| AWS Compatibility | 8/10 | API-based, can deploy to AWS |
| Pricing | 8/10 | Free tier: 500 messages/day; Pro $79/month |
| Developer Experience | 9/10 | Excellent SDK, OpenAPI spec |
| Reliability | 9/10 | Built-in retry with exponential backoff |
| Lock-in Risk | 5/10 | Proprietary, but webhook format is standard |

**Alternatives Considered:**
- **AWS EventBridge:** Only for AWS-to-AWS events
- **Custom Implementation:** High complexity for reliability features
- **Hookdeck:** Similar features, slightly higher price

**Decision:** Keep Svix. Webhook delivery is complex; Svix handles edge cases.

---

### 3. Payments: Stripe

**Current Status:** KEEP

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 10/10 | Industry standard, subscriptions, credits, invoicing |
| AWS Compatibility | 10/10 | Universal API |
| Pricing | 7/10 | 2.9% + $0.30 per transaction |
| Developer Experience | 10/10 | Best-in-class SDK, documentation |
| Reliability | 10/10 | Industry-leading uptime |
| Lock-in Risk | 4/10 | PCI compliance handled, but migration complex |

**Alternatives Considered:**
- **Paddle:** Better for SaaS, handles tax compliance
- **LemonSqueezy:** Simpler, but less feature-rich

**Decision:** Keep Stripe. No compelling reason to change; excellent integration.

---

### 4. Email: Resend

**Current Status:** KEEP

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 8/10 | React Email support, good deliverability |
| AWS Compatibility | 9/10 | Can use with SES as fallback |
| Pricing | 9/10 | Free tier: 3K emails/month; Pro $20/month |
| Developer Experience | 9/10 | React Email integration excellent |
| Reliability | 8/10 | Good, but newer service |
| Lock-in Risk | 3/10 | Email is standard; easy to switch |

**Alternatives Considered:**
- **AWS SES:** Cheaper at scale, but less developer-friendly
- **Postmark:** Better deliverability, higher price
- **SendGrid:** More features, more complex

**Decision:** Keep Resend. Perfect for React Email templates; cost-effective.

---

### 5. Analytics: PostHog

**Current Status:** KEEP

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 9/10 | Events, sessions, feature flags, experiments |
| AWS Compatibility | 9/10 | Self-hostable on AWS |
| Pricing | 9/10 | Generous free tier: 1M events/month |
| Developer Experience | 8/10 | Good SDK, but occasional complexity |
| Reliability | 8/10 | Self-hosted option for control |
| Lock-in Risk | 3/10 | Open-source; data exportable |

**Alternatives Considered:**
- **Mixpanel:** Better UX, higher price
- **Amplitude:** Enterprise features, complex
- **Plausible:** Privacy-focused, less features

**Decision:** Keep PostHog. Open-source with excellent free tier.

---

### 6. Error Tracking: Sentry

**Current Status:** KEEP

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 10/10 | Errors, performance, releases, source maps |
| AWS Compatibility | 10/10 | Universal; Lambda support |
| Pricing | 8/10 | Free tier: 5K errors/month |
| Developer Experience | 10/10 | Industry standard |
| Reliability | 10/10 | Proven at scale |
| Lock-in Risk | 3/10 | Open-source; self-hostable |

**Decision:** Keep Sentry. Industry standard for error tracking.

---

### 7. Collaboration: LiveBlocks

**Current Status:** EVALUATE

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 8/10 | Real-time cursors, presence, storage |
| AWS Compatibility | 8/10 | API-based |
| Pricing | 6/10 | Free tier limited; Pro $59/month |
| Developer Experience | 8/10 | Good React hooks |
| Reliability | 8/10 | WebSocket-based |
| Lock-in Risk | 7/10 | Proprietary real-time format |

**Alternatives Considered:**
- **Custom WebSocket:** We're building WebSocket for device streaming
- **Yjs + y-websocket:** Open-source CRDT
- **PartyKit:** Serverless real-time

**Decision:** EVALUATE for removal. We're building WebSocket infrastructure for device control and task streaming. May be redundant. Keep for now; revisit after backend completion.

---

### 8. AI Tool Integrations: Composio

**Current Status:** ADD (Recommended)

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 10/10 | 500+ pre-built integrations, OAuth handling |
| AWS Compatibility | 9/10 | API-based; AWS Marketplace available |
| Pricing | 8/10 | Free tier: 1K calls/month; Pro $99/month |
| Developer Experience | 9/10 | SDK for Python/JS, AI framework support |
| Reliability | 8/10 | Managed OAuth token refresh |
| Lock-in Risk | 5/10 | Abstracts integrations; some lock-in |

**Why Add:**
- Eliminates weeks of OAuth implementation per integration
- Supports Anthropic, OpenAI, LangChain, Vercel AI SDK
- Pre-built tools for Gmail, Calendar, Notion, Slack, GitHub
- SOC 2 compliant

**Decision:** ADD Composio. Essential for AI agent tool integrations.

---

### 9. Workflow Orchestration: Inngest

**Current Status:** ADD (Recommended)

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 10/10 | Durable execution, retries, scheduling, events |
| AWS Compatibility | 10/10 | Lambda-native; AWS Marketplace |
| Pricing | 9/10 | Free tier: 50K executions/month |
| Developer Experience | 10/10 | Code-first, TypeScript native |
| Reliability | 9/10 | Built-in retry and idempotency |
| Lock-in Risk | 6/10 | Proprietary, but functions are portable |

**Why Add:**
- Replaces need for custom job queues
- Perfect for AI agent task orchestration
- Handles long-running tasks with checkpointing
- Built-in observability

**Decision:** ADD Inngest. Critical for task orchestration.

---

### 10. Code Sandboxing: E2B

**Current Status:** ADD (Recommended)

**Evaluation:**

| Criteria | Score | Notes |
|----------|-------|-------|
| Functionality | 10/10 | Firecracker MicroVMs, 150ms startup |
| AWS Compatibility | 10/10 | Same tech as Lambda; EC2 deployable |
| Pricing | 8/10 | Free tier: $100 credit; Pro $150/month |
| Developer Experience | 9/10 | Python/JS SDKs |
| Reliability | 9/10 | Hardware-level isolation |
| Lock-in Risk | 4/10 | Standard code execution; portable |

**Why Add:**
- Required for safe AI-generated code execution
- Firecracker provides true isolation
- Fast startup enables interactive use
- 24-hour sessions for complex tasks

**Decision:** ADD E2B. Essential for code execution safety.

---

## Final Recommendations

### Services to KEEP

| Service | Category | Monthly Cost (Estimated) |
|---------|----------|--------------------------|
| **Knock** | Notifications | $99+ |
| **Svix** | Webhooks | $79+ |
| **Stripe** | Payments | ~2.9% + $0.30/tx |
| **Resend** | Email | $20+ |
| **PostHog** | Analytics | Free - $450+ |
| **Sentry** | Error Tracking | Free - $26+ |

### Services to ADD

| Service | Category | Monthly Cost (Estimated) |
|---------|----------|--------------------------|
| **Composio** | AI Tools | $99+ |
| **Inngest** | Workflows | $75+ |
| **E2B** | Sandboxing | $150+ |

### Services to EVALUATE

| Service | Category | Action |
|---------|----------|--------|
| **LiveBlocks** | Collaboration | Review after backend WebSocket implementation |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THIRD-PARTY SERVICE LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │   Composio    │  │   Inngest     │  │     E2B       │           │
│  │   (Tools)     │  │  (Workflows)  │  │  (Sandbox)    │           │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘           │
│          │                  │                  │                    │
│          └──────────────────┼──────────────────┘                    │
│                             │                                       │
│                             ▼                                       │
│                    ┌───────────────┐                               │
│                    │ Agent Service │                               │
│                    └───────────────┘                               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │     Knock     │  │     Svix      │  │    Resend     │           │
│  │ (Notifications)│ │  (Webhooks)   │  │    (Email)    │           │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘           │
│          │                  │                  │                    │
│          └──────────────────┼──────────────────┘                    │
│                             │                                       │
│                             ▼                                       │
│                    ┌───────────────┐                               │
│                    │   Gateway     │                               │
│                    └───────────────┘                               │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │    Stripe     │  │   PostHog     │  │    Sentry     │           │
│  │  (Payments)   │  │  (Analytics)  │  │   (Errors)    │           │
│  └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cost Projections

### MVP Phase (0-1000 users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Knock | Pro | $99 |
| Svix | Pro | $79 |
| Stripe | Usage | ~$50 |
| Resend | Pro | $20 |
| PostHog | Free | $0 |
| Sentry | Team | $26 |
| Composio | Pro | $99 |
| Inngest | Pro | $75 |
| E2B | Pro | $150 |
| **Total** | | **~$598/month** |

### Growth Phase (1000-10,000 users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Knock | Business | $499 |
| Svix | Business | $299 |
| Stripe | Usage | ~$500 |
| Resend | Business | $100 |
| PostHog | Growth | $450 |
| Sentry | Business | $80 |
| Composio | Business | $499 |
| Inngest | Business | $250 |
| E2B | Enterprise | $500 |
| **Total** | | **~$3,177/month** |

---

## Consequences

### Positive
- Reduced development time (estimated 3-6 months saved)
- Production-ready infrastructure from day one
- Focus on core product differentiation
- Managed security and compliance

### Negative
- Monthly operational costs
- Multiple vendor relationships
- Potential integration complexity

### Risks
- Vendor pricing changes
- Service outages affecting multiple features
- Feature limitations requiring workarounds

### Mitigations
- Build abstraction layers for critical services
- Monitor usage to optimize costs
- Maintain fallback options for critical paths
- Negotiate enterprise contracts as scale increases

---

## References

- [Knock Documentation](https://docs.knock.app/)
- [Svix Documentation](https://docs.svix.com/)
- [Composio Documentation](https://docs.composio.dev/)
- [Inngest Documentation](https://www.inngest.com/docs)
- [E2B Documentation](https://e2b.dev/docs)
