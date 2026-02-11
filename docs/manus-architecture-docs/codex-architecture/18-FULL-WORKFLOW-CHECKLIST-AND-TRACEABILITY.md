# Full Workflow Checklist and Traceability

## Goal
Ensure no critical path is undocumented by mapping each workflow step to code references, target contracts, and migration phase.

## A. Signup/Login checklist
1. Proxy public/auth route logic documented.
2. Email existence check with anti-enumeration documented.
3. Better-auth route integration documented.
4. Verification state documented.
5. Authenticated layout guard documented.

## B. Chat bootstrap checklist
1. Server-side session fetch documented.
2. Initial messages query + dedup rules documented.
3. Chat client hydration and part normalization documented.
4. Initial queued message injection documented.

## C. Chat execution checklist
1. Prompt submit to `/api/chat` documented.
2. Session upsert behavior documented.
3. Agent stream proxy path documented.
4. Fallback provider path documented.
5. Server-side persistence on stream finalization documented.

## D. Stream reliability checklist
1. SSE keepalive behavior documented.
2. Resumable stream endpoint documented.
3. Redis absent branch documented.
4. Active stream id cleanup documented.

## E. WebSocket and state checklist
1. Gateway token issue path documented.
2. Connect/reconnect/ping-pong documented.
3. Event-to-slice reducer mapping documented.
4. Offline queue behavior documented.

## F. Tool/runtime checklist
1. Local tools vs sandbox tools vs connector tools documented.
2. Browser/terminal stream proxy adapters documented.
3. File upload route and forwarding headers documented.
4. Device safety approval path documented.

## G. Billing and governance checklist
1. Credits state machine documented.
2. Limit enforcement checkpoints documented.
3. Usage ledger requirement documented.
4. Rollback gates documented.

## H. Traceability map
| Workflow Area | Current Code Anchor | Target Architecture Doc | Migration Phase |
|---|---|---|---|
| Auth route gating | `apps/app/proxy.ts` | `15`, `17` | Phase 2/6 |
| Login/signup UX | `apps/app/app/(unauthenticated)/login/page.tsx` | `15`, `17` | Phase 6 |
| Auth APIs | `apps/app/app/api/auth/*` | `15`, `16` | Phase 2 |
| Chat API stream | `apps/app/app/api/chat/route.ts` | `15`, `16` | Phase 2/4 |
| Stream resume | `apps/app/app/api/chat/[id]/stream/route.ts` | `15`, `17` | Phase 4 |
| SSE transform | `apps/app/lib/chat/agent-proxy.ts` | `15`, `16` | Phase 4 |
| WS middleware | `apps/app/lib/store/middleware/websocket.middleware.ts` | `16`, `17` | Phase 6 |
| Store wiring | `apps/app/lib/store/index.ts` | `05`, `16` | Phase 6 |
| E2B adapters | `services/agent/src/runtime/*`, `services/sandbox/*` | `07`, `08` | Phase 3/4 |
| File adapter | `apps/app/app/api/files/upload/route.ts`, `services/file/*` | `06`, `07` | Phase 7 |

## I. Remaining non-canonical details (must be finalized during build)
1. Final endpoint naming after Node orchestrator cutover (`/v1/...` vs adapter aliases).
2. Final event envelope version and migration adapters.
3. Final slice retirement list after runtime telemetry window.
4. Final DB migration scripts for timeline segmentation and usage ledger.

## J. Definition of “fully documented” for this program
All checklist lines A-I must have:
1. implementation owner,
2. contract schema id,
3. test case id,
4. rollout gate,
5. rollback instruction.
