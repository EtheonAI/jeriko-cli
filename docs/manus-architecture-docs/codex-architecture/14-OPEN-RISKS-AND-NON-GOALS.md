# Open Risks and Non-Goals

## Open risks
1. Manus internals are inferred from documentation artifacts, not production source access.
2. Contradiction risk remains if older docs are used over canonical guide part 10.
3. Migration risk from Python orchestrator to Node orchestrator can introduce subtle tool behavior regressions.
4. Multi-runtime complexity (Node orchestrator + Go media + E2B runtime) needs strict ownership boundaries.
5. Slice consolidation can break hidden dependencies if telemetry-based usage audit is skipped.
6. Billing correctness risk if usage events are not immutable and replay-safe.

## Mitigations
1. Canonical precedence: guide part 10 -> guide part 9 -> this package.
2. Golden task parity suite before traffic cutover.
3. Contract-first architecture (`packages/contracts`) with CI schema compatibility checks.
4. Progressive rollout with rollback triggers.
5. Runtime usage telemetry before deleting slices/services.

## Non-goals
1. Blindly cloning proprietary Manus implementation details.
2. Forcing multi-agent execution in every task.
3. Keeping duplicate control planes for convenience.
4. Preserving legacy slices with no product function.
5. Shipping new architecture without end-to-end replay correctness.

## Contradictions closed in this package
1. "Multiple sandboxes per task" as default: rejected.
2. "OpenAI inside E2B does main orchestration": rejected.
3. "Separate planner LLM + executor LLM as baseline": rejected.
4. "Keep both sandbox and agent lifecycle authorities": rejected.

## External source validation status
1. E2B docs and Manus case study reviewed.
2. Neko docs/repo reviewed for WebRTC service assumptions.
3. Composio official docs reviewed for connector contracts.
4. `2505.02024v1.pdf` text is now available in full (user-provided transcription in this workspace session) and used as a conceptual reference only.
5. The paper is treated as non-authoritative for Manus production internals; canonical behavior still comes from `guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`.

## Final build guardrails
1. Every new endpoint/event/tool must have shared schema and tests.
2. Every rollout phase must include kill switch and rollback path.
3. No doc in this folder may contradict `guide/10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`.
