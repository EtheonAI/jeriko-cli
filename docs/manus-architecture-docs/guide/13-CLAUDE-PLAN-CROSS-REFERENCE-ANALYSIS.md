# Part 13: Claude Implementation Plan — Cross-Reference Analysis

**Date:** 2026-02-10
**Scope:** 5 documents (README.md, EXECUTIVE-SUMMARY.md, MADR-001, IMPLEMENTATION-ROADMAP.md, TESTING-STRATEGY.md) — 3,614 lines total
**Cross-Referenced Against:** 14 architecture investigation documents + 12 build guide documents + live sandbox verification
**Codex Review:** Also cross-referenced against Codex's independent review (pasted_content_5.txt)

---

## 1. Executive Verdict

**Architecture direction: APPROVED — correct and aligned with verified findings.**

**Execution documents: NOT SAFE TO EXECUTE AS-IS — 3 critical math errors, 12 tool name errors, 4 cost claim contradictions, and 10 missing implementation tasks.**

Codex's review identified 3 critical issues and 4 gaps. I confirm ALL of Codex's findings are correct, and I found 15 additional issues Codex missed. The combined correction list below is the canonical fix set.

---

## 2. Codex Review Verification

Codex found 6 issues. Here is my verdict on each:

| # | Codex Finding | My Verdict | Evidence |
|---|--------------|------------|----------|
| 1 | Timeline math: "10 weeks (50 days)" but roadmap goes Day 1-72 | **CONFIRMED CORRECT** | Phase 0: Days 1-3, Phase 1: Days 4-10, Phase 2: Days 11-24, Phase 3: Days 25-29, Phase 4: Days 30-43, Phase 5: Days 44-48, Phase 6: Days 49-62, Phase 7: Days 63-67, Phase 8: Days 68-72. Total = 72 working days = 14.4 weeks. |
| 2 | Rollback contradicts retirement: keep Python 14 days but Day 72 deletes it | **CONFIRMED CORRECT** | MADR-001 line 248: "Rollback window: 14 days post-100%". Roadmap Day 72 (P8.10): "Delete Python agent code". Day 72 is the SAME week as 100% cutover, not 14 days after. |
| 3 | Testing numbers self-contradictory | **CONFIRMED CORRECT** | TESTING-STRATEGY.md intro pyramid: "20 E2E / 50 contract / 200 integration / 1000+ unit". Summary table (line 1257-1267): "30 E2E / 209 contract / 68 integration / 113 unit = 455 total". Completely different numbers. |
| 4 | Cost claims inconsistent: "40% lower", "40x cheaper", "97% savings" | **CONFIRMED CORRECT** | EXECUTIVE-SUMMARY line 23: "40% lower map tool costs". Line 104: "40x cheaper". Line 243: "$15 → $0.40 = 97% savings". The 97% ($15→$0.40 = 37.5x) is correct. "40% lower" is WRONG — it should be "97% lower". |
| 5 | Approval status inconsistent | **CONFIRMED CORRECT** | README line 3: "Ready for Approval". EXECUTIVE-SUMMARY line 4: "Ready for Approval". MADR-001 line 4: "APPROVED". |
| 6 | Broken reference path | **CONFIRMED CORRECT** | README line 52 references `guide/10-CONTRADICTION-REGISTER.md`. Actual filename is `10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md`. |

**Score: Codex found 6/6 correct issues. Zero false positives.**

---

## 3. Codex's 4 Gaps — Verified and Expanded

Codex identified 4 missing implementation areas. I confirm all 4 and expand them:

### Gap 1: No LLM Proxy / Forge API Contract Tasks

**Codex is correct.** The Forge API is the backbone of all AI capabilities inside the sandbox. Our investigation verified:

- `BUILT_IN_FORGE_API_KEY` — server-side, full access to all Forge services
- `VITE_FRONTEND_FORGE_API_KEY` — client-side, maps-only access
- `OPENAI_BASE_URL` points to `https://api.manus.im/v1` (Forge proxy, NOT OpenAI direct)
- Forge provides: LLM completion, image generation, voice transcription (Whisper), notifications, maps, S3 storage

**Missing tasks to add:**
- P1.X: Define Forge API request/response schemas (LLM, image gen, voice, storage)
- P2.X: Implement Forge proxy adapter in orchestrator
- P4.X: Test Forge API integration for all 7 service endpoints

### Gap 2: No Skills Loading Pipeline / Context Compaction Tasks

**Codex is correct.** Our investigation verified:

- Skills live at `/home/ubuntu/skills/{name}/SKILL.md`
- `.skill_versions.json` tracks installed skills
- Skills are loaded progressively: name → description → full SKILL.md content
- Context compaction uses `<compacted_history>` XML tags to replace old tool call records
- System prompt assembly has 15+ XML-tagged sections that must be built dynamically

**Missing tasks to add:**
- P2.X: Implement system prompt assembly pipeline (all XML sections)
- P2.X: Implement skill loader (3-level progressive loading)
- P2.X: Implement context compaction (history management, token budget)
- P2.X: Implement knowledge base injection (`<related_knowledge>` section)

### Gap 3: No Statesync / Code-Server Runtime Tasks

**Codex is correct.** Our investigation verified:

- `statesync` runs on port 8333, config at `/opt/.manus/statesync/config.yaml` (pull: true, push: false)
- `code-server` runs on port 8329, password randomly generated at boot
- Both are critical for the Management UI's Code panel and file sync

**Missing tasks to add:**
- P5.X: Implement statesync lifecycle management in orchestrator
- P5.X: Implement code-server session routing
- P5.X: Test file sync between sandbox and Management UI

### Gap 4: No Map Output Schema Validation / Aggregation Contract

**Codex is correct.** Our investigation verified:

- Map tool accepts `output_schema` with typed fields (string, number, boolean, file)
- `file` type is special — transfers files FROM subtask sandbox TO main sandbox
- Max 2000 subtasks
- Subtask results must be aggregated and returned to main agent loop

**Missing tasks to add:**
- P1.X: Define map output_schema Zod validation
- P4.X: Implement map result aggregation with file transfer
- P4.X: Test map tool with file-type outputs across sandbox boundaries

---

## 4. Additional Issues Codex MISSED (15 Items)

### Issue 7: Tool Names Are Wrong Throughout the Roadmap

The roadmap uses tool names that don't match the actual Manus tool definitions. This is a significant issue because the Zod schemas in Phase 1 will be wrong if they use these names.

| Roadmap Name | Actual Tool Name | Actual Action/Parameter |
|-------------|-----------------|------------------------|
| `file.str_replace` | `file` | `action: "edit"` with `edits: [{find, replace}]` |
| `file.find_in_content` | `match` | `action: "grep"` with `regex` param |
| `file.find_by_name` | `match` | `action: "glob"` with `scope` param |
| `shell.exec` | `shell` | `action: "exec"` with `command` param |
| `shell.view` | `shell` | `action: "view"` |
| `shell.wait` | `shell` | `action: "wait"` |
| `shell.write_to_process` | `shell` | `action: "send"` with `input` param |
| `shell.kill_process` | `shell` | `action: "kill"` |
| `browser.navigate` | `browser` | Entrance tool — `url`, `intent`, `focus` params |
| `browser.view` | `browser_view` | Sub-tool after browser entrance |
| `browser.click` | `browser_click` | Sub-tool after browser entrance |
| `deploy.expose_port` | `expose` | `port` param |
| `deploy.apply_deployment` | **DOES NOT EXIST** | No such tool in Manus |

**Impact:** Phase 1 (Contracts) and Phase 4 (Tool Parity) will produce incorrect schemas if they use these names.

**Fix:** The tools are NOT namespaced with dots. Each tool is a top-level function with an `action` parameter for sub-operations. The browser is special — `browser` is an entrance tool, and after calling it, 12 additional `browser_*` tools become available.

### Issue 8: Browser Tool Count Is Wrong

The roadmap says "13 browser tools" (Appendix A, line 1063). Our live investigation confirmed **12 browser sub-tools** after the entrance tool. The entrance tool (`browser`) itself is counted separately in the base 29 tools.

### Issue 9: Tool Count Breakdown Is Wrong

Appendix A (line 1058-1069) lists:
- File: 5 tools — **WRONG**: There are 2 tools (`file` with 5 actions, `match` with 2 actions)
- Shell: 5 tools — **WRONG**: There is 1 tool (`shell` with 5 actions)
- Browser: 13 tools — **WRONG**: 1 entrance tool + 12 sub-tools
- Search: 1 tool — **CORRECT**
- Message: 3 tools — **WRONG**: 1 tool (`message` with 3 types: info, ask, result)
- Deploy: 2 tools — **WRONG**: 1 tool (`expose`), `apply_deployment` doesn't exist

The actual base tool set is: `shell`, `file`, `match`, `browser`, `search`, `message`, `plan`, `schedule`, `map`, `expose`, `generate`, `slides` = **12 entrance-level tools** that expand to 29+ total capabilities via actions and mode switching.

### Issue 10: No Mention of `plan` Tool

The `plan` tool is one of the most critical tools — it's how the agent creates and manages task plans. It has `update` and `advance` actions. The roadmap never mentions implementing it. This is a local tool (runs on orchestrator, not sandbox) that updates the plan state and emits `plan.update` / `plan.advance` events.

### Issue 11: No Mention of `schedule` Tool

The `schedule` tool allows the agent to schedule future or recurring tasks. It supports `cron` and `interval` types. Not mentioned anywhere in the roadmap.

### Issue 12: `apply_deployment` Tool Does Not Exist

Appendix A lists `apply_deployment` as a deploy tool. This tool does not exist in Manus. The only deployment-related tool is `expose` (expose a local port for temporary public access). Actual deployment/publishing is done through the Management UI's Publish button, not through a tool.

### Issue 13: No Mention of `webdev_*` Tool Implementation

The roadmap's Appendix A mentions webdev tools exist (line 1074) but there are NO implementation tasks for the 7 webdev tools anywhere in the 8 phases:
- `webdev_init_project`
- `webdev_add_feature`
- `webdev_save_checkpoint`
- `webdev_check_status`
- `webdev_restart_server`
- `webdev_rollback_checkpoint`
- `webdev_execute_sql`

These are complex tools that manage project lifecycle, git operations, database setup, and dev server management. They need dedicated implementation tasks.

### Issue 14: No Mention of Generate/Slides Sub-Call Implementation

The roadmap mentions mode expansion (browser) but doesn't have explicit tasks for implementing the **nested sub-call pattern** used by `generate` and `slides` tools. These require:
- Spawning a separate LLM call with a different tool set
- Returning results back to the main agent loop
- The `generate` sub-call provides `generate_image` tool
- The `slides` sub-call provides slide creation tools

### Issue 15: CDN/S3 Upload Flow Not Documented

Our investigation verified `manus-upload-file` utility uploads to `files.manuscdn.com` with the pattern:
```
files.manuscdn.com/user_upload_by_module/session_file/{user_id}/{random}.{ext}
```

The roadmap's Phase 7 mentions "file provenance" but doesn't document the actual CDN upload mechanism or the `manus-upload-file` utility equivalent.

### Issue 16: `.secrets` Directory Not Mentioned

Our investigation found `/home/ubuntu/.secrets/sandbox_api_token` — a file-based secret that equals `OPENAI_API_KEY`. The 4-layer env injection in Phase 3 doesn't mention this file-based secret mechanism.

### Issue 17: Neko Password Generation Not Mentioned

Our investigation verified Neko and code-server passwords are randomly generated at first boot by their startup scripts. Phase 5 (Media Path Hardening) doesn't mention this boot-time credential generation.

### Issue 18: SUBPROCESS_BAGGAGE for Sentry Tracing Not Mentioned

Our investigation found `SUBPROCESS_BAGGAGE` env var contains Sentry release hash and trace context. Phase 2's OpenTelemetry setup doesn't mention this Sentry integration mechanism.

### Issue 19: Event Count Discrepancy

The roadmap and MADR consistently say "21 event types" (from Part 10 of the codex). However, our investigation identified **18 canonical event types** that we could verify from the live sandbox. The 3 additional events (making 21) may exist but we couldn't verify them. The documents should note which events are verified vs. projected.

### Issue 20: Database Choice Not Specified

The roadmap says "Drizzle ORM" and "Postgres" (CI config line 1112 uses `postgres:17`), but our investigation found Manus uses **TiDB (MySQL-compatible)** for the webdev database. The roadmap should clarify whether Rubic will use Postgres (current) or migrate to TiDB (Manus-style).

### Issue 21: No Mention of Context Window Management

Our investigation verified the system prompt is massive (15+ XML sections, tool definitions, skills, knowledge, etc.). The roadmap has no tasks for managing the context window — token counting, history truncation, `<compacted_history>` replacement, or deciding when to compress.

---

## 5. What Is CONFIRMED CORRECT

Despite the issues above, the core architecture is solid. Here is everything that matches our verified findings:

### Architecture Decisions (All Correct)

| Decision | Roadmap Claim | Our Verification |
|----------|--------------|------------------|
| Single Node.js orchestrator | Replace Python agent | ✅ Confirmed — Manus uses single orchestrator |
| AI SDK `streamText` | Core agent loop mechanism | ✅ Confirmed — `maxSteps` controls loop iterations |
| Claude for orchestration | Planning, reasoning, communication | ✅ Confirmed — Claude is the brain |
| OpenAI for parallel subtasks | Map tool uses GPT-4.1-mini | ✅ Confirmed — GPT-4.1-mini/nano in subtask sandboxes |
| One sandbox per user | Shared across sessions | ✅ Confirmed — sandbox hibernates, resumes |
| 4-layer env injection | Template → boot → user → runtime | ✅ Confirmed — exact mechanism verified |
| OPENAI_API_KEY injected at PTY creation | Not in files, not in start_server env | ✅ Confirmed — verified via /proc/PID/environ |
| Canonical event protocol | Versioned, strongly-typed | ✅ Confirmed — 18-21 event types |
| Zod schemas for contracts | Type-safe tool definitions | ✅ Confirmed — AI SDK uses Zod natively |
| Progressive rollout | 5% → 25% → 50% → 100% | ✅ Correct approach |
| Service consolidation 14 → 4 | orchestrator, webrtc, connector, file | ✅ Correct boundary decisions |
| Composio for connectors | Auth boundary separate | ✅ Confirmed — Composio handles OAuth |
| Drizzle ORM | Database access layer | ✅ Confirmed — Manus webdev uses Drizzle |
| Feature flag rollback | `ORCHESTRATOR_VERSION=python\|node` | ✅ Correct approach |
| Shadow mode before cutover | Mirror traffic, compare results | ✅ Correct approach |
| Golden suite regression testing | Replay prod sessions | ✅ Excellent approach |

### Phase Structure (Correct)

The 8-phase ordering is logically sound:
1. **Contracts first** — correct, establishes shared vocabulary
2. **Orchestrator bootstrap** — correct, core before periphery
3. **Sandbox consolidation** — correct, single control plane before tools
4. **Tool parity** — correct, tools depend on sandbox
5. **Media hardening** — correct, WebRTC is independent
6. **Frontend consolidation** — correct, frontend depends on event protocol
7. **File/billing** — correct, correctness after functionality
8. **Cutover** — correct, last phase

### Testing Approach (Correct in Concept)

The golden suite + shadow mode + progressive rollout approach is exactly right. The specific test counts are contradictory (as Codex noted), but the methodology is sound.

---

## 6. Severity-Ranked Fix List

### CRITICAL (Must Fix Before Execution)

| # | Issue | Fix |
|---|-------|-----|
| C1 | Timeline: 72 days ≠ 50 days ≠ 10 weeks | Recalculate: either compress phases to 50 days or update all references to "15 weeks (72 days)" |
| C2 | Tool names wrong throughout | Replace all dot-namespaced names with actual tool names and action parameters |
| C3 | Testing numbers contradictory | Pick ONE set of numbers and use consistently across all 5 documents |
| C4 | Cost claims: "40% lower" vs "97% savings" | Use "97% lower cost" ($15→$0.40, ~37.5x cheaper) consistently |
| C5 | `apply_deployment` doesn't exist | Remove from tool inventory, replace with note about Management UI Publish |

### HIGH (Must Fix Before Phase 1)

| # | Issue | Fix |
|---|-------|-----|
| H1 | No `plan` tool implementation task | Add to Phase 2 or Phase 4 |
| H2 | No `schedule` tool implementation task | Add to Phase 4 |
| H3 | No `webdev_*` tools implementation tasks | Add dedicated tasks (7 tools, complex lifecycle) |
| H4 | No generate/slides nested sub-call tasks | Add to Phase 2 (mode manager) or Phase 4 |
| H5 | No Forge API contract tasks | Add to Phase 1 (contracts) and Phase 2 (adapter) |
| H6 | No context window management tasks | Add to Phase 2 (prompt builder) |
| H7 | Approval status inconsistent | Pick "Ready for Approval" or "APPROVED", use consistently |
| H8 | Broken reference path in README | Fix filename to `10-CONTRADICTION-REGISTER-AND-CANONICAL-DECISIONS.md` |

### MEDIUM (Fix Before Phase 3)

| # | Issue | Fix |
|---|-------|-----|
| M1 | No skills loading pipeline tasks | Add to Phase 2 (system prompt builder) |
| M2 | No statesync/code-server tasks | Add to Phase 5 (media hardening) |
| M3 | No CDN upload flow documentation | Add to Phase 7 (file correctness) |
| M4 | No `.secrets` directory documentation | Add to Phase 3 (env injection) |
| M5 | Rollback 14 days vs Day 72 retirement | Move retirement to Day 82 (14 days after Day 68 cutover start) |
| M6 | Database: Postgres vs TiDB clarification | Document which DB Rubic will use |

### LOW (Fix Before Phase 8)

| # | Issue | Fix |
|---|-------|-----|
| L1 | Neko password generation not mentioned | Add to Phase 5 |
| L2 | SUBPROCESS_BAGGAGE not mentioned | Add to Phase 2 (OpenTelemetry) |
| L3 | Event count: 21 vs 18 verified | Note which events are verified vs projected |
| L4 | Browser tool count: 13 vs 12 | Fix to 12 sub-tools + 1 entrance tool |

---

## 7. Corrected Timeline

The roadmap says "10 weeks (50 working days)" but the actual day plan runs to Day 72. Here is the corrected timeline:

### Option A: Keep 72 Days (Recommended — More Realistic)

| Phase | Days | Duration | Calendar |
|-------|------|----------|----------|
| 0: Freeze/Baseline | 1-3 | 3 days | Feb 11-13 |
| 1: Contracts | 4-10 | 7 days | Feb 14-24 |
| 2: Orchestrator | 11-24 | 14 days | Feb 25 - Mar 14 |
| 3: Sandbox | 25-29 | 5 days | Mar 15-21 |
| 4: Tool Parity | 30-43 | 14 days | Mar 22 - Apr 8 |
| 5: Media | 44-48 | 5 days | Apr 9-15 |
| 6: Frontend | 49-62 | 14 days | Apr 16-May 5 |
| 7: File/Billing | 63-67 | 5 days | May 6-12 |
| 8: Cutover | 68-72 | 5 days | May 13-19 |
| **Python retirement** | **82** | **Day 82** | **Jun 2** |
| **TOTAL** | **72 days** | **~15 weeks** | Feb 11 - May 19 |

### Option B: Compress to 50 Days (Aggressive)

Remove 22 days by:
- Phase 2: 14 → 10 days (cut shadow mode testing)
- Phase 4: 14 → 10 days (parallelize tool implementation)
- Phase 6: 14 → 8 days (cut dead slice removal, do post-cutover)

**Risk:** Less testing time, higher chance of regression.

---

## 8. Corrected Tool Inventory

Replace Appendix A with this verified inventory:

### Base Tools (Always Available) — 12 Tools

| Tool | Actions/Params | Sandbox? | Description |
|------|---------------|----------|-------------|
| `shell` | exec, view, wait, send, kill | Yes (PTY via start_server) | Shell session management |
| `file` | read, write, edit, append, view | Yes (filesystem via start_server) | File operations |
| `match` | glob, grep | Yes (filesystem via start_server) | File/content search |
| `browser` | url, intent, focus | Yes (CDP via Playwright) | **Entrance tool** — opens browser, unlocks 12 sub-tools |
| `search` | info, image, api, news, tool, data, research | No (orchestrator-side) | Web search |
| `message` | info, ask, result | No (orchestrator-side) | User communication |
| `plan` | update, advance | No (orchestrator-side) | Task planning |
| `schedule` | cron, interval | No (orchestrator-side) | Task scheduling |
| `map` | prompt_template, inputs, output_schema | No (orchestrator spawns subtask sandboxes) | Parallel processing |
| `expose` | port | Yes (socat proxy) | Expose local port |
| `generate` | — | No (nested sub-call) | **Entrance tool** — unlocks generate_image |
| `slides` | slide_content_file_path, slide_count | No (nested sub-call) | **Entrance tool** — unlocks slide tools |

### Browser Sub-Tools (After `browser` Entrance) — 12 Tools

`browser_view`, `browser_click`, `browser_input`, `browser_scroll`, `browser_scroll_up`, `browser_scroll_down`, `browser_move_mouse`, `browser_key_press`, `browser_select_option`, `browser_console_exec`, `browser_console_view`, `browser_take_screenshot`

### WebDev Tools (After `webdev_init_project`) — 7 Tools

`webdev_init_project`, `webdev_add_feature`, `webdev_save_checkpoint`, `webdev_check_status`, `webdev_restart_server`, `webdev_rollback_checkpoint`, `webdev_execute_sql`

### Generate Sub-Tools (After `generate` Entrance) — 1+ Tools

`generate_image` (possibly `generate_video`, `generate_audio`, `generate_speech`)

### Slides Sub-Tools (After `slides` Entrance) — TBD

Slide creation and management tools (exact names not verified from live sandbox)

---

## 9. Corrected Cost Analysis

| Metric | Before (Claude Only) | After (Hybrid) | Savings | Correct Claim |
|--------|---------------------|----------------|---------|---------------|
| Map tool per 1M input tokens | ~$3.00 (Claude 3.5 Sonnet) | ~$0.15 (GPT-4.1-mini) | **95% savings** | NOT "40% lower" |
| Map tool per 1M output tokens | ~$15.00 (Claude 3.5 Sonnet) | ~$0.60 (GPT-4.1-mini) | **96% savings** | NOT "40% lower" |
| Blended (input+output) | ~$9.00 avg | ~$0.375 avg | **~96% savings (~24x cheaper)** | Use "~96% savings" or "~24x cheaper" |
| If using GPT-4.1-nano | ~$9.00 avg | ~$0.05 avg | **~99.4% savings (~180x cheaper)** | For simple subtasks |

**The "40% lower" claim in EXECUTIVE-SUMMARY line 23 is the most egregious error.** It should be "~96% lower" or "~24x cheaper". The "97% savings" claim on line 243 is approximately correct. The "40x cheaper" claim on line 104 is in the right ballpark but should be "24x cheaper" for GPT-4.1-mini specifically.

---

## 10. Final Assessment

### Agreement with Codex's Review

I agree with **100% of Codex's findings**. Codex found 6 issues and 4 gaps — all verified correct. Codex's final assessment is accurate:

> "Architecture direction: approved. Execution documents: not execution-safe yet until contradictions are resolved and missing tasks are added."

### My Additional Findings

I found **15 additional issues** that Codex missed, primarily around:
- Tool naming conventions (12 tools named wrong)
- Missing tool implementations (plan, schedule, webdev, generate/slides)
- Missing infrastructure details (Forge API, CDN upload, .secrets, context management)

### Combined Fix Count

| Severity | Codex Found | I Found | Total |
|----------|------------|---------|-------|
| Critical | 3 | 2 | **5** |
| High | 3 | 5 | **8** |
| Medium | 0 | 6 | **6** |
| Low | 0 | 4 | **4** |
| **TOTAL** | **6** | **17** | **23** |

### Recommendation

**Apply all 23 fixes, then the plan is execution-safe.** The architecture is correct. The phasing is correct. The methodology (golden suite + shadow mode + progressive rollout) is excellent. The issues are all in the details — wrong names, wrong numbers, missing tasks — not in the fundamental design.

The single most important fix is **C2 (tool names)** because it affects Phase 1 (Contracts) which is the foundation for everything else. If the Zod schemas use wrong tool names, every downstream phase inherits the error.

---

## 11. Summary Table: All 23 Fixes

| # | Severity | Category | Issue | Fix |
|---|----------|----------|-------|-----|
| C1 | Critical | Timeline | 72 days ≠ 50 days ≠ 10 weeks | Update to "15 weeks (72 days)" or compress |
| C2 | Critical | Tools | Tool names wrong (12 errors) | Use actual names: shell, file, match, browser, etc. |
| C3 | Critical | Testing | Test counts contradictory | Pick one set, use consistently |
| C4 | Critical | Cost | "40% lower" vs "97% savings" | Use "~96% savings (~24x cheaper)" |
| C5 | Critical | Tools | `apply_deployment` doesn't exist | Remove, note Management UI Publish |
| H1 | High | Tools | No `plan` tool tasks | Add to Phase 2/4 |
| H2 | High | Tools | No `schedule` tool tasks | Add to Phase 4 |
| H3 | High | Tools | No `webdev_*` tool tasks | Add dedicated phase or extend Phase 4 |
| H4 | High | Tools | No generate/slides sub-call tasks | Add to Phase 2 (mode manager) |
| H5 | High | Contracts | No Forge API contract tasks | Add to Phase 1 and Phase 2 |
| H6 | High | Orchestrator | No context window management | Add to Phase 2 (prompt builder) |
| H7 | High | Docs | Approval status inconsistent | Pick one, use consistently |
| H8 | High | Docs | Broken reference path | Fix filename |
| M1 | Medium | Orchestrator | No skills loading pipeline | Add to Phase 2 |
| M2 | Medium | Infrastructure | No statesync/code-server tasks | Add to Phase 5 |
| M3 | Medium | Storage | No CDN upload flow | Add to Phase 7 |
| M4 | Medium | Security | No `.secrets` directory docs | Add to Phase 3 |
| M5 | Medium | Rollback | 14-day window vs Day 72 retirement | Move retirement to Day 82 |
| M6 | Medium | Database | Postgres vs TiDB unclear | Document decision |
| L1 | Low | Infrastructure | Neko password generation | Add to Phase 5 |
| L2 | Low | Observability | SUBPROCESS_BAGGAGE missing | Add to Phase 2 |
| L3 | Low | Events | 21 vs 18 verified events | Note verification status |
| L4 | Low | Tools | Browser: 13 vs 12 sub-tools | Fix to 12 |

---

**Document Version:** 1.0.0
**Author:** Manus AI
**Cross-Referenced Against:** 26 source documents + live sandbox verification
**Codex Review Status:** All 6 findings confirmed correct
