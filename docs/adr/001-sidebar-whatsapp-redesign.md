# ADR-001: Sidebar WhatsApp-Inspired Redesign

**Status:** Implemented
**Date:** 2026-02-01
**Decision Makers:** Development Team
**Implementation Date:** 2026-02-01

## Context

The current Rubic sidebar lacks the rich interaction patterns and information density needed for an effective personal AI assistant. Users need to quickly scan recent tasks, understand their status (read/unread), and perform actions without leaving the sidebar.

### Current State Analysis

| Component | Current Implementation | Limitations |
|-----------|----------------------|-------------|
| Chat Items | Icon + Title only | No timestamp, no message preview, no status indicator |
| Notifications | Binary red dot | No differentiation between unread counts or urgency |
| Actions Menu | None | Cannot rename, share, delete, or favorite chats |
| Navigation | Files, Applications, Actions, Devices | Generic icons, no visual segmentation |
| Filters | None | Cannot filter by unread/pinned/all |

### Design Inspiration Research

After analyzing the provided design inspirations:

#### WhatsApp Web Design (Primary Inspiration)
**Strengths:**
- **Information Hierarchy**: Avatar → Name → Timestamp (top), Message Preview (bottom)
- **Status Indicators**: Green checkmarks (sent/delivered/read), typing indicators
- **Filter Tabs**: All | Unread | Groups - instant context switching
- **Icon Rail**: Vertical navigation with clear feature segmentation
- **Three-dots Menu**: Context-aware actions without cluttering the UI

**Key Metrics:**
- Chat item height: 72-80px (allows for 2-line preview)
- Avatar size: 48px (prominent but not overwhelming)
- Font sizes: 14px name, 13px preview, 12px timestamp
- Hover states: Reveal action buttons progressively

#### Robinhood Notifications (Secondary)
**Strengths:**
- **Date Grouping**: Today, Yesterday, Last Week sections
- **Color-coded Avatars**: Unique colors for different notification types
- **Detail Panel**: Click to expand without navigating away

#### Manus AI Chat Field
**Strengths:**
- **Draggable Items**: Reorder by drag-and-drop
- **Progressive Disclosure**: Three-dots appears on hover
- **Compact Design**: 36px height for dense lists

## Decision

### Chosen Approach: WhatsApp-Inspired Hybrid Design

We will adopt WhatsApp's proven UX patterns while adapting them for an AI assistant context:

```
┌─────────────────────────────────────┐
│ ┌─────┐  New Task          [🔍]    │  Header
│ └─────┘                            │
├─────────────────────────────────────┤
│ ╭─────╮ ╭─────╮ ╭─────╮ ╭─────╮   │  Navigation Icons
│ │ 📊 │ │ 🔗 │ │ ⚡ │ │ 📱 │   │  (Insights, Apps, Actions, Devices)
│ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯   │
├─────────────────────────────────────┤
│ [All] [Unread] [Pinned]            │  Filter Tabs
├─────────────────────────────────────┤
│ ┌──┐ Task Name              2:34pm │  Chat Item (Enhanced)
│ │🤖│ Last message preview...   ●  │  - Avatar with status
│ └──┘                          [⋯] │  - Timestamp + unread badge
├─────────────────────────────────────┤
│ ┌──┐ Another Task          Yesterday│
│ │📧│ Email sent successfully  ✓✓  │
│ └──┘                          [⋯] │
└─────────────────────────────────────┘
```

### Design Decisions

#### 1. Chat Item Layout (WhatsApp Grid Pattern)
**Decision:** Grid layout with `auto 1fr` columns

**Rationale:**
- WhatsApp's layout is proven across 2B+ users
- Information density: Shows 4 data points (avatar, name, time, preview) in 72px height
- Scannable: Users can quickly identify tasks by avatar color/icon

**Implementation:**
```
┌────────────────────────────────────────────────┐
│ [Avatar]  [Name]                    [Timestamp]│
│   48px    [Message Preview...]      [●] [⋯]   │
│           (truncated)               badge menu │
└────────────────────────────────────────────────┘
```

#### 2. Status Indicators
**Decision:** Multi-state visual indicators

| Status | Visual | Meaning |
|--------|--------|---------|
| Unread | Blue filled circle | New AI response/task update |
| In Progress | Pulsing dot | Task actively running |
| Completed | Green checkmark | Task finished successfully |
| Error | Red exclamation | Task failed, needs attention |
| Pinned | Star icon | User-pinned for quick access |

**Rationale:**
- AI assistants have more states than messaging apps
- Color-coded status helps prioritize attention
- Matches mental model of task management

#### 3. Three-Dots Context Menu
**Decision:** Implement full context menu from design inspiration

**Menu Items:**
1. **Rename** (PenLine icon) - Edit task title
2. **Share** (Share icon) - Generate shareable link
3. **Add to Favorites** (Star icon) - Pin to top
4. **Open in New Tab** (ExternalLink icon) - Open in separate view
5. **Archive** (Archive icon) - Hide from main list
6. **Delete** (Trash2 icon, destructive) - Remove permanently

**Rationale:**
- Progressive disclosure keeps UI clean
- Matches user expectations from WhatsApp/Slack
- Destructive action (delete) visually differentiated

#### 4. Navigation Redesign
**Decision:** Icon-centric navigation with segmentation

**Current → New Mapping:**
| Current | New Icon | New Label | Purpose |
|---------|----------|-----------|---------|
| Files | LayoutDashboard | Insights | AI-generated dashboards/reports |
| Applications | Link2 | Connections | Connected apps/integrations |
| Actions | Zap | Automations | Active workflows/triggers |
| Devices | Smartphone | Devices | Connected devices |

**Rationale:**
- "Files" is passive; "Insights" reflects AI-generated value
- "Applications" → "Connections" emphasizes integration nature
- Icons updated to be more semantic and WhatsApp-inspired

#### 5. Filter Tabs
**Decision:** Three-tab filter system

**Tabs:**
- **All** (default) - All chats/tasks
- **Unread** - Items with unread updates
- **Pinned** - User-favorited items

**Rationale:**
- WhatsApp's proven pattern for quick filtering
- "Pinned" more useful than "Groups" for AI assistant
- Badge counts on tabs show pending items

## Technical Implementation

### Phase 1: Functionality (Build First)
1. Add `lastMessage`, `lastMessageTime`, `isRead`, `isPinned` to Chat type
2. Implement three-dots dropdown menu component
3. Add rename, delete, pin/unpin actions with API hooks
4. Add filter state management

### Phase 2: UI Redesign
1. Refactor ChatItem to grid layout with enhanced info
2. Add status indicator components
3. Implement filter tabs component
4. Update navigation icons and labels

### Phase 3: Polish
1. Add hover states and transitions (150ms ease)
2. Implement progressive disclosure for menu
3. Add loading skeletons
4. Test accessibility (keyboard navigation, screen readers)

## Data Model Changes

```typescript
type Chat = {
  id: string;
  title: string;
  // New fields
  lastMessage?: string;
  lastMessageTime?: Date;
  status: 'unread' | 'read' | 'in_progress' | 'completed' | 'error';
  isPinned?: boolean;
  isArchived?: boolean;
  avatarColor?: string;
  avatarIcon?: string;
};
```

## Consequences

### Positive
- Richer information at a glance
- Familiar UX patterns from WhatsApp
- Better task management with context menus
- Faster navigation with filters

### Negative
- Increased component complexity
- More state to manage
- Slightly taller chat items (72px vs 36px)

### Risks
- Over-engineering for MVP
- Performance with many items (mitigate: virtualization)

## Alternatives Considered

### Alternative 1: Slack-Style Design
**Rejected because:**
- Channel-based, not task-based
- Less emphasis on individual item status
- More complex threading model

### Alternative 2: Linear/Notion Style
**Rejected because:**
- Too minimal for AI assistant needs
- Lacks real-time status indicators
- Better suited for document-centric apps

### Alternative 3: Keep Current + Add Menu Only
**Rejected because:**
- Misses opportunity for better information density
- Doesn't solve status visibility problem
- Incremental vs transformational improvement

## References

- WhatsApp Web design screenshots (provided)
- Robinhood notifications UI (provided)
- Manus AI chat field implementation (provided)
- [WhatsApp UX Analysis](https://uxplanet.org/whatsapp-ux-analysis)
- [Nielsen Norman Group: Information Density](https://www.nngroup.com/articles/information-density/)

## Decision Outcome

**Approved for Implementation**

The WhatsApp-inspired hybrid design provides the best balance of:
1. **Familiarity** - Users already know these patterns
2. **Information Density** - More data visible without clutter
3. **Actionability** - Context menus enable quick actions
4. **Scalability** - Works with 10 or 1000 items

---

## Implementation Summary

### Components Created/Modified

| Component | File | Description |
|-----------|------|-------------|
| `ChatItemMenu` | `chat-item-menu.tsx` | Three-dots dropdown with Share, Rename, Favorite, Open in New Tab, Archive, Delete |
| `RenameChatDialog` | `rename-chat-dialog.tsx` | Modal for renaming chats with input validation |
| `DeleteChatDialog` | `delete-chat-dialog.tsx` | Confirmation alert dialog for delete action |
| `ChatFilterTabs` | `chat-filter-tabs.tsx` | All/Unread/Pinned filter tabs with badge counts |
| `ChatStoreProvider` | `use-chat-store.tsx` | React context for chat state management |
| `ChatItem` | `chat-item.tsx` | WhatsApp-style chat item with avatar, status, preview |
| `RecentChats` | `recent-chats.tsx` | Updated to use new store and filter tabs |
| `NavSection` | `nav-section.tsx` | Updated icons and labels (Insights, Connections, Automations, Devices) |
| `GlobalSidebar` | `index.tsx` | Wrapped with ChatStoreProvider, enhanced sample data |

### Features Implemented

- [x] Three-dots context menu with 6 actions
- [x] Rename chat dialog
- [x] Delete chat with confirmation
- [x] Pin/Favorite chat functionality
- [x] WhatsApp-style chat item layout (avatar, name, timestamp, preview, status)
- [x] Multi-state status indicators (unread, read, in_progress, completed, error)
- [x] Filter tabs (All, Unread, Pinned) with badge counts
- [x] Updated navigation with semantic icons and labels
- [x] Hover-reveal progressive disclosure for menu
- [x] Proper sorting (pinned first, then by time)

### Data Model

```typescript
type Chat = {
  id: string;
  title: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  status: 'unread' | 'read' | 'in_progress' | 'completed' | 'error';
  isPinned?: boolean;
  isArchived?: boolean;
  createdAt?: Date;
};
```

*Implementation completed on 2026-02-01*
