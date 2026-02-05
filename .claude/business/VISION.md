# Rubic - Business Vision

## Core Vision

Rubic is the world's first universal AI agent platform that combines:

1. **DAG-based multi-agent orchestration** - Multiple specialized agents working in parallel
2. **500+ app integrations** via Composio MCP
3. **Universal device control** via Home Assistant MCP
4. **Code execution** via E2B sandboxing
5. **Website building** with AI-powered code generation

## Competitive Positioning

| Feature            | Manus.im      | ChatGPT                | Rubic            |
| ------------------ | ------------- | ---------------------- | ---------------- |
| Multi-agent DAG    | Yes           | No                     | Yes              |
| App integrations   | Limited       | Plugins                | 500+ (Composio)  |
| Device control     | No            | No                     | Yes (HA + PC)    |
| Code execution     | Yes (sandbox) | Yes (Code Interpreter) | Yes (E2B)        |
| Website builder    | Yes           | No                     | Yes (E2B + TiDB) |
| Self-hosted option | No            | No                     | Planned          |
| Real-time collab   | No            | No                     | Yes (Liveblocks) |
| Custom webhooks    | No            | Limited                | Yes (Svix)       |
| AI email           | No            | No                     | Yes (AgentMail)  |

## Unique Differentiators

1. **Universal device control** - Control PCs, smart home, IoT from chat
2. **DAG orchestration** - Agents run in parallel, not sequentially
3. **500+ integrations** - Connect any app, not just a few plugins
4. **Credit-based pricing** - Pay for what you use
5. **Open ecosystem** - Webhooks, APIs, self-host option

## Pricing Model

### Subscription Tiers

| Plan           | Monthly | Yearly | Credits/mo | Features                                   |
| -------------- | ------- | ------ | ---------- | ------------------------------------------ |
| **Free**       | $0      | $0     | 100        | Basic chat, 1 agent, 5 connectors          |
| **Pro**        | $20     | $192   | 2,000      | All agents, 50 connectors, file storage    |
| **Max**        | $50     | $480   | 10,000     | Unlimited agents, all connectors, priority |
| **Enterprise** | Custom  | Custom | Custom     | SSO, SLA, dedicated support                |

### Credit Costs

| Action                     | Credits |
| -------------------------- | ------- |
| Chat message (GPT-4o)      | 1       |
| Chat message (Claude Opus) | 3       |
| Agent task (multi-step)    | 5-50    |
| Code execution             | 2       |
| File generation            | 1       |
| Web browsing               | 1       |
| Image generation           | 5       |
| Device command             | 1       |

### Credit Packages (one-time)

| Package    | Credits | Price | Per Credit |
| ---------- | ------- | ----- | ---------- |
| Starter    | 100     | $10   | $0.10      |
| Growth     | 500     | $40   | $0.08      |
| Power      | 2,000   | $120  | $0.06      |
| Enterprise | 10,000  | $500  | $0.05      |

## Target Users

1. **Tech professionals** - Developers, designers, data scientists
2. **SMBs** - Small businesses needing AI automation
3. **Smart home enthusiasts** - Users wanting AI-controlled devices
4. **Digital agencies** - Teams building websites and automations
5. **Enterprise** - Organizations needing secure, self-hosted AI

## Performance Requirements

- **Chat response start:** < 500ms (time to first token)
- **Agent task planning:** < 2s
- **WebSocket latency:** < 100ms
- **Search results:** < 200ms
- **File upload:** < 5s for 10MB
- **Device command:** < 1s execution
- **99.9% uptime** for production

## Go-to-Market

### Phase 1: MVP (Now → Month 2)

- Core chat with Claude/GPT
- Basic file management
- Stripe billing
- 5-10 Composio integrations

### Phase 2: Growth (Month 3-6)

- Full Composio integration (500+ apps)
- Device control
- Website builder
- E2B code execution
- Mobile app

### Phase 3: Scale (Month 6-12)

- Enterprise features (SSO, audit logs)
- Self-hosted option
- Marketplace for custom agents/skills
- API for developers
- International expansion
