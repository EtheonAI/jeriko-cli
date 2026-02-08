# ADR-002: Evaluation of ai-sdk-tools by Midday AI

**Status:** REJECTED
**Date:** 2026-02-08
**Author:** Rubic Engineering
**Deciders:** @khaleelmusleh

---

## Context

[ai-sdk-tools](https://ai-sdk-tools.dev/) is a community toolkit by [Midday AI](https://midday.ai) (GitHub: [midday-ai/ai-sdk-tools](https://github.com/midday-ai/ai-sdk-tools)) that extends the Vercel AI SDK with 6 packages: store, agents, artifacts, cache, devtools, and memory. Before adopting it in Rubic, we conducted a full architectural evaluation.

### Project Vitals

| Metric | Value |
|---|---|
| GitHub Stars | ~1,700 |
| Last Commit | November 21, 2025 (~2.5 months stale) |
| Primary Maintainer | Pontus Abrahamsson (Midday AI founder) |
| Latest Version | 1.2.0 |
| Weekly NPM Downloads (store) | ~16,400 |
| Weekly NPM Downloads (agents) | ~3,700 |
| Self-described status | "Currently in active development and breaking changes may occur between versions" |

For context: the `ai` package itself gets 20M+ downloads/month. These are niche adoption numbers.

---

## Decision: REJECT — Do Not Adopt

**ai-sdk-tools is built for AI SDK v5. Rubic uses AI SDK v6. This is a hard blocker.**

Beyond the version incompatibility, every package has a fundamental architectural mismatch with Rubic's stack. We evaluated all 6 packages individually.

---

## BLOCKING Issue: AI SDK Version Incompatibility

| Factor | ai-sdk-tools | Rubic |
|---|---|---|
| `@ai-sdk/react` | `^2.0.82` (v5) | `^3.0.29` (v6) |
| `ai` | v5 patterns | `^6.0.27` |
| `useChat` API | v5 (`experimental_resume`) | v6 (`resume: true`, `DefaultChatTransport`) |
| Agent API | v5 (`generateText`/`streamText`) | v6 (`ToolLoopAgent`, renamed APIs) |

Evidence:
- Peer dependency: `@ai-sdk/react: "^2.0.82"` — hard v5 lock
- Agents page explicitly states: "Multi-agent orchestration for AI SDK v5"
- No commits, issues, or PRs reference v6 migration
- Other ecosystem tools (Trigger.dev, Cloudflare Agents SDK, Convex Agent) all did explicit v6 migration work. ai-sdk-tools has not.

**The only ways to adopt would be:**
1. Downgrade Rubic to AI SDK v5 — Unacceptable regression (loses `resume`, `DefaultChatTransport`, v6 stream protocol)
2. Wait for Midday to ship v6 support — No timeline, project may be stale
3. Fork and migrate — Defeats the purpose of adopting a library

---

## Package-by-Package Analysis

### 1. @ai-sdk-tools/store — Zustand Chat State

**What it does:** Wraps `useChat` with Zustand for global state access. Claims 3-5x performance and O(1) message lookups. Eliminates prop drilling.

**Key exports:** `useChat()` (drop-in replacement), `useChatMessages()`, `useChatStatus()`, `createAIStore()`, `Provider`

**Dependencies:** `zustand`, `@ai-sdk/react ^2.x` (INCOMPATIBLE)

| Criterion | Assessment |
|---|---|
| Version compat | INCOMPATIBLE — `@ai-sdk/react ^2.x` |
| Problem it solves | Prop drilling, local-only chat state |
| Rubic's situation | Redux provides global state (46 slices). No prop drilling problem exists. |
| `DefaultChatTransport` support | No mention in docs |
| `resume: true` support | No mention in docs |
| Risk of feature regression | HIGH — could break resumable streams, transport config |

**Verdict: REJECT** — Rubic already has global state via Redux. Adding Zustand would create a parallel state system. No evidence of `transport` or `resume` support, which Rubic depends on.

---

### 2. @ai-sdk-tools/agents — Multi-Agent Orchestration

**What it does:** TypeScript multi-agent orchestration with handoffs, pattern-based routing, guardrails, and memory integration.

**Key exports:** `Agent` class, `agent.generate()`, `agent.stream()`, `agent.toUIMessageStream()`

**Dependencies:** `@ai-sdk-tools/memory`, `ai` (v5 patterns)

| Criterion | Assessment |
|---|---|
| Version compat | INCOMPATIBLE — explicitly built for AI SDK v5 |
| Problem it solves | TypeScript multi-agent orchestration |
| Rubic's situation | Agent is Python FastAPI (~4,877 LOC, 32 tools, Manus-aligned) |
| Architecture decision | Rubic chose sequential planner + executor (90%), NOT multi-agent |
| Research basis | DeepMind: multi-agent degrades sequential tasks by 39-70%, costs 15x more tokens |

**Verdict: REJECT** — Wrong language (Python vs TypeScript), wrong paradigm (sequential vs multi-agent), incompatible version. Rubic's agent architecture decision is documented and deliberate.

---

### 3. @ai-sdk-tools/memory — Persistent Agent Memory

**What it does:** Working memory (scratchpad), conversation history, session tracking. Providers: InMemory, Drizzle, Upstash.

| Criterion | Assessment |
|---|---|
| Version compat | Tied to agents package (v5-only) |
| Problem it solves | Persistent chat memory |
| Rubic's situation | Messages persist to PostgreSQL via Drizzle in `route.ts` finally block. Sessions auto-titled. Full parts field loaded via `page.tsx`. |

**Verdict: REJECT** — Rubic already has this. Messages, sessions, parts, and metadata all persist to PostgreSQL.

---

### 4. @ai-sdk-tools/artifacts — Typed Streaming Artifacts

**What it does:** Zod-validated streaming data structures from AI tools to React components with progress tracking.

**Key exports:** `artifact(id, schema)`, `useArtifact()`, `useArtifacts()`

| Criterion | Assessment |
|---|---|
| Version compat | INCOMPATIBLE — depends on store (which requires `@ai-sdk/react ^2.x`) |
| Problem it solves | Type-safe artifact streaming from tools |
| Rubic's situation | Custom pipeline: `SSEProcessor` → `useCanvas` → `BrowserView` + 33 tool renderers |
| Migration cost | Rewrite Python agent tool outputs to emit Zod-compatible schemas + rewrite all 33 renderers |

**Verdict: REJECT** — Would require rewriting both the Python agent's output format AND all 33 frontend tool renderers. Rubic's custom pipeline is already working and tested.

---

### 5. @ai-sdk-tools/cache — Tool Execution Caching

**What it does:** Wraps TypeScript AI SDK `tool()` definitions with LRU or Redis caching. Claims 80% cost reduction.

**Key exports:** `cached(tool, opts)`, `createCachedFunction()`, `createCacheBackend()`

| Criterion | Assessment |
|---|---|
| Version compat | Likely incompatible (v5 tool patterns) |
| Problem it solves | Caching deterministic TypeScript tool calls |
| Rubic's situation | All 32 tools are Python functions in the agent service, not TypeScript `tool()` definitions |

**Verdict: REJECT** — Not applicable. Rubic's tools are Python, not TypeScript. The package cannot wrap them.

---

### 6. @ai-sdk-tools/devtools — Debugging UI

**What it does:** Real-time debugging: tool call monitoring, streaming events, state changes, performance metrics.

**Key exports:** `<AIDevTools />`, `useAIDevTools()`

| Criterion | Assessment |
|---|---|
| Version compat | INCOMPATIBLE (v1.2.0 pre-v6) |
| Problem it solves | AI debugging and monitoring |
| Rubic's situation | Custom SSE pipeline — DevTools would only see post-transform data, not raw agent events |
| Independent utility | Most useful of the 6 packages, conceptually |

**Verdict: REJECT (for now)** — Most promising package but still version-incompatible. If it ships v6 support and Rubic lacks sufficient observability, reconsider. For now, structured logging in the SSE pipeline is more valuable.

---

## What ai-sdk-tools Solves vs. What Rubic Needs

| ai-sdk-tools Solves | Rubic's Existing Solution |
|---|---|
| Prop drilling for chat state | Redux (46 slices, global store) |
| TypeScript multi-agent orchestration | Python FastAPI agent service (4,877 LOC) |
| Zustand-based chat store | Redux + tRPC (160+ procedures) |
| TypeScript tool caching | Tools are Python functions in agent service |
| Zod artifact streaming | Custom SSEProcessor + useCanvas + 33 tool renderers |
| Persistent memory | PostgreSQL via Drizzle (messages, sessions, parts) |
| `useChat` global access | `useChatSession` hook + Redux sync |
| DevTools | Structured logging in SSE pipeline |

**Every problem ai-sdk-tools solves is already solved in Rubic's architecture.**

---

## Risk Summary

| Factor | Rating | Detail |
|---|---|---|
| AI SDK v6 compatibility | BLOCKING | All packages target v5 (`@ai-sdk/react ^2.x`) |
| Maintenance | HIGH RISK | 2.5 months stale, single maintainer, no v6 work |
| Breaking changes | HIGH RISK | Self-described: "breaking changes may occur" |
| Adoption | LOW | ~16K/week (store) vs 20M+/month (AI SDK core) |
| Architecture fit | POOR | Redux vs Zustand, Python vs TypeScript, custom pipeline vs standardized |
| `DefaultChatTransport` | NO EVIDENCE | Not mentioned in any docs |
| `resume: true` | NO EVIDENCE | Resumable streams not mentioned |
| Bus factor | 1 person | Pontus Abrahamsson, also running Midday AI product |

---

## Alternatives Considered

| Alternative | Why Preferred |
|---|---|
| **Keep current architecture** (CHOSEN) | Everything works: Redux global state, custom SSE pipeline, 33 tool renderers, resumable streams, Python agent service. No gaps that ai-sdk-tools fills. |
| **Adopt @ai-sdk-tools/store only** | Still v5-incompatible. Would add Zustand alongside Redux (two state systems). Doesn't support `transport` or `resume`. |
| **Adopt @ai-sdk-tools/devtools only** | Most viable candidate but still v5-incompatible. Revisit when v6 support ships. |
| **Fork and migrate to v6** | Defeats the purpose. Would need to maintain a fork of 6 packages. |
| **Wait for v6 support** | No timeline. Project may be abandoned. Don't block on it. |

---

## Consequences

### Positive
- No migration risk or breaking changes
- No second state management system (Zustand alongside Redux)
- No dependency on a single-maintainer project with breaking change warnings
- Resumable streams, DefaultChatTransport, and resume:true continue working
- Custom SSE pipeline and 33 tool renderers remain under our control

### Negative
- No access to DevTools debugging UI (mitigated by structured logging)
- Must maintain custom tool rendering pipeline ourselves (already done)

---

## When to Revisit

Re-evaluate ai-sdk-tools if ALL of the following conditions are met:
1. ai-sdk-tools ships AI SDK v6 support (`@ai-sdk/react ^3.x`)
2. It demonstrates 6+ months of active maintenance
3. It reaches >100K weekly downloads (indicating ecosystem maturity)
4. Rubic identifies a specific unsolved problem that a package addresses

Until then, Rubic's existing architecture is the correct choice.

---

## References

- [ai-sdk-tools Homepage](https://ai-sdk-tools.dev/)
- [ai-sdk-tools GitHub](https://github.com/midday-ai/ai-sdk-tools)
- [ai-sdk-tools Store Docs](https://ai-sdk-tools.dev/docs/store)
- [ai-sdk-tools Agents Docs](https://ai-sdk-tools.dev/docs/agents)
- [ai-sdk-tools Artifacts Docs](https://ai-sdk-tools.dev/docs/artifacts)
- [ai-sdk-tools Cache Docs](https://ai-sdk-tools.dev/docs/cache)
- [ai-sdk-tools DevTools Docs](https://ai-sdk-tools.dev/docs/devtools)
- [AI SDK v6 Announcement](https://vercel.com/blog/ai-sdk-6)
- [AI SDK v6 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
- [Rubic ADR-001: Canvas Triggers & Resumable Streams](./ADR-001-canvas-triggers-resumable-streams.md)
