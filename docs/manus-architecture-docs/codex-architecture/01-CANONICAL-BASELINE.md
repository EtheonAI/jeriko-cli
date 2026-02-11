# Canonical Baseline

## Authority
- Primary authority: `docs/manus-architecture-docs/guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`
- Secondary authority: `docs/manus-architecture-docs/guide/09-CORRECTED-AGENT-ARCHITECTURE.md`
- Supporting conceptual reference: `docs/manus-architecture-docs/guide/2505.02024v1.pdf` (survey-style framing, non-canonical for internals)

## Non-negotiables
1. Hybrid architecture: one Claude-class orchestrator loop, plus map sub-agents in separate sandboxes.
2. One main sandbox per user, reused across sessions; map creates temporary subtask sandboxes.
3. Two mode mechanisms:
- Tool expansion: `browser`, `webdev_init_project`.
- Nested sub-call: `generate`, `slides`.
4. Orchestrator owns: prompt assembly, tool contracts, loop execution, routing, event emission, persistence, billing.
5. Sandbox runtime is execution gateway model; routing semantics matter more than implementation language.
6. Runtime env layering is mandatory: template baseline -> boot-time vars -> user secrets -> per-call runtime injection.
7. Event protocol is first-class and versioned.
8. Composio is the connector provider.

## Explicit corrections retained
- Part 7 oversimplification is superseded by Part 9.
- Old misc docs are evidence only; not canonical design input.

## Delivery principles
1. No parallel architecture branches.
2. No duplicated control planes.
3. No hidden contracts; all cross-service payloads must be in shared schemas.
4. No rollout without e2e and rollback plan.
