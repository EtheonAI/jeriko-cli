# Redux Slice Feature Mapping — ALL 44 Manus Slices COVERED

**Source**: `redux_state_complete_analysis.json` + `Redux-State-Slice-Explanations.md`
**Date**: Feb 6 2026
**Status**: ALL 46 slices implemented (43 Manus-aligned + 3 Rubic-specific). 0 missing.

---

## Final Accounting

| Category | Count | Slices |
|----------|-------|--------|
| **Core slices (Manus-aligned)** | 16 | api, auth, chat, configs, connectors, fileManagement, sessions, team, ui, websocket, notifications, projects, scheduledTasks, billing, library, navbar |
| **Workspace slices** | 9 | agentWorkspace, codeViewer, filePreviewer, fileShare, onboarding, sessionSwitch, timeline, fileConnector, knowledge |
| **Feature slices** | 11 | skills, enterpriseTeam, agentMail, meeting, myBrowser, webDev, aiCanvas, aiCanvasEditor, community, example, experiment |
| **Additional slices** | 7 | guestPage, login, mapReduce, products, slideEditor, webDevUsage, webdevAuth |
| **Rubic-specific** | 3 | agents, devices, search |
| **Merges applied** | 2 | chatPage→chat, files→library |
| **Skipped** | 1 | _persist (Redux Persist infra) |
| **TOTAL** | **46 slices** | All 44 Manus slices accounted for |

---

## Name Mappings (Rubic → Manus)

| Rubic Name | Manus Name | Reason |
|-----------|------------|--------|
| `billing` | `biz` | Clearer name |
| `notifications` | `notification` | Plural convention |
| `projects` | `project` | Plural convention |
| `scheduledTasks` | `scheduledTask` | Plural convention |
| `agentMail` | `mailManus` | Brand-appropriate |
| `agents` | — | Rubic-specific |
| `devices` | — | Rubic-specific |
| `search` | — | Rubic-specific |

---

## Previous "Skipped" Slices — NOW ALL CREATED

The previous version of this doc listed 17 slices as "skipped." As of Feb 6 2026, **all have been created**:

| Slice | Keys | Created | Notes |
|-------|------|---------|-------|
| `agentMail` (was mailManus) | 7 | Yes | Renamed from mailManus |
| `meeting` | 1 | Yes | shouldShowMeetingIntro |
| `myBrowser` | 2 | Yes | browserSettings, allowInstall |
| `webDev` | 3 | Yes | isFullscreenMode, userClickedTab, activeTab |
| `aiCanvas` | 2 | Yes | allAiCanvas, ocrCache |
| `aiCanvasEditor` | 18 | Yes | Full canvas editor state |
| `community` | 4 | Yes | dataSource, groupedIds, etc. |
| `example` | 2 | Yes | exampleList, exampleListLoading |
| `experiment` | 2 | Yes | variants, backendVariants |
| `guestPage` | 1 | Yes | isInGuestPage |
| `login` | 20 | Yes | Full login flow state |
| `mapReduce` | 2 | Yes | startLoading, isFullscreen |
| `products` | 3 | Yes | files, inputValue, playbookInfo |
| `slideEditor` | 2 | Yes | slides, sessionUid |
| `webDevUsage` | 6 | Yes | Usage tracking |
| `webdevAuth` | 0 | Yes | Empty placeholder |

---

## Next Steps

All Redux slices are implemented. The work now is **wiring slices to UI components**.

See:
- `docs/IMPLEMENTATION_ROADMAP.md` — Full feature roadmap with priorities
- `.claude/IMPLEMENTATION_CHECKLIST.md` — Checklist by priority tier (P0/P1/P2/P3)
