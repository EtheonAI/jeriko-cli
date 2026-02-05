# Sidebar Menu - Build Instructions

## Current State

### Sidebar Component (`apps/app/app/(authenticated)/components/sidebar/index.tsx`, 86 lines)

Uses `@repo/design-system` Sidebar primitives. Structure:

- `SidebarHeader`: NewTaskButton + SearchButton
- `NavSection`: 6 nav items (Library, Applications, Knowledge, Automations, Devices, Builder)
- `SidebarSeparator`
- Recent Chats: **HARDCODED** array of 8 dummy chats
- `SidebarFooter`: User avatar + settings

### Problems

1. **Dummy chats**: 8 hardcoded chat items (`recentChats` array at line 34-43)
2. **No logo**: No branding/logo at the top of sidebar
3. **Knowledge & Builder links**: Must be removed (features deprecated)
4. **No filter/sort**: Can't filter chats by type, favorites, date
5. **New Task button**: Needs to create a real session
6. **Search button**: Needs to open a real search dialog
7. **No favorites**: Can't star/favorite sessions
8. **No grouping**: Chats not grouped by date (Today, Yesterday, Last Week, etc.)

### Sub-components

- `chat-item.tsx` (136 lines): Link to `/chat/[id]`, icon based on title keywords, dropdown menu (Share, Rename, Favorite, Open in new tab, Archive, Delete) — all non-functional
- `nav-section.tsx` (83 lines): 6 nav items with icons, active state based on pathname
- `new-task-button.tsx`: Button component for creating new tasks
- `search-button.tsx`: Button component for search
- `sidebar-footer.tsx`: User info + settings trigger

---

## What Needs Building

### 1. Remove Knowledge & Builder Nav Items (IMMEDIATE)

**In `nav-section.tsx`**, remove these entries from `navItems`:

```typescript
// REMOVE:
{ title: "Knowledge", icon: BookOpenIcon, href: "/knowledge" },
{ title: "Builder", icon: CodeIcon, href: "/website-builder" },
```

Also delete the page routes:

- `apps/app/app/(authenticated)/knowledge/` — DELETE entire directory
- `apps/app/app/(authenticated)/website-builder/` — DELETE entire directory

**Updated navItems:**

```typescript
const navItems = [
  { title: "Library", icon: FolderIcon, href: "/files" },
  { title: "Applications", icon: Link2Icon, href: "/applications" },
  { title: "Automations", icon: ZapIcon, href: "/actions" },
  { title: "Devices", icon: SmartphoneIcon, href: "/devices" },
];
```

### 2. Add Logo/Branding at Top

Add a logo placeholder at the very top of the sidebar, above NewTaskButton.

```tsx
<SidebarHeader className="p-2">
  {/* Logo */}
  <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
      R
    </div>
    <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">Rubic</span>
  </div>

  <SidebarMenu className="gap-1">
    <SidebarMenuItem>
      <NewTaskButton />
    </SidebarMenuItem>
    <SidebarMenuItem>
      <SearchButton />
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>
```

### 3. Replace Dummy Chats with Real Sessions from DB

**Remove** the hardcoded `recentChats` array.

**Fetch real sessions:**

```typescript
"use client";
import { api } from "@/lib/trpc/client";

// In GlobalSidebar component:
const { data: sessions, isLoading } = api.sessions.list.useQuery({
  limit: 50,
  orderBy: "updatedAt",
});
```

**Group by date:**

```typescript
function groupSessionsByDate(sessions: Session[]) {
  const groups: Record<string, Session[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    let label: string;
    if (date >= today) label = "Today";
    else if (date >= yesterday) label = "Yesterday";
    else if (date >= lastWeek) label = "Last 7 days";
    else label = "Older";

    if (!groups[label]) groups[label] = [];
    groups[label].push(session);
  }
  return groups;
}
```

Render grouped:

```tsx
{
  Object.entries(groupedSessions).map(([label, chats]) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {chats.map((chat) => (
            <ChatItem key={chat.id} chat={chat} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
```

### 4. Filter & Sort Panel (Manus-style)

Add a filter button that opens a dropdown/popover with filtering options.

**Create:** `apps/app/app/(authenticated)/components/sidebar/filter-panel.tsx`

**Filter options:**

```typescript
interface FilterState {
  favorites: boolean; // Show only favorited sessions
  taskType: string | null; // Filter by task icon/type
  dateRange: "all" | "today" | "week" | "month";
  sortBy: "recent" | "alphabetical" | "oldest";
  searchQuery: string; // Local filter by title
}
```

**Task type filters** (based on chat-item.tsx icon mapping):

- All (default)
- Research (SearchIcon)
- Coding (CodeIcon)
- Design (PaletteIcon)
- Data (DatabaseIcon)
- Email/Mail (MailIcon)
- Meetings (ActivityIcon)
- Weather (CloudSunIcon)

**UI Layout:**

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="size-7">
      <FilterIcon className="size-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-64 p-3" align="start">
    {/* Favorites toggle */}
    <div className="flex items-center justify-between">
      <span className="text-sm">Favorites only</span>
      <Switch checked={filters.favorites} onCheckedChange={...} />
    </div>

    <Separator className="my-2" />

    {/* Task type filter pills */}
    <div className="flex flex-wrap gap-1">
      {taskTypes.map(type => (
        <Badge
          key={type.id}
          variant={filters.taskType === type.id ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("taskType", type.id)}
        >
          <type.icon className="size-3 mr-1" />
          {type.label}
        </Badge>
      ))}
    </div>

    <Separator className="my-2" />

    {/* Sort */}
    <Select value={filters.sortBy} onValueChange={...}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="recent">Most recent</SelectItem>
        <SelectItem value="alphabetical">A-Z</SelectItem>
        <SelectItem value="oldest">Oldest first</SelectItem>
      </SelectContent>
    </Select>
  </PopoverContent>
</Popover>
```

Place the filter button next to the "Recent" label.

### 5. Fix New Task Button

The New Task button should create a new session and navigate to it.

**In `new-task-button.tsx`:**

```typescript
const router = useRouter();
const createSession = api.sessions.create.useMutation();

const handleNewTask = async () => {
  const session = await createSession.mutateAsync({
    title: null, // Will be auto-titled from first message
    status: "active",
  });
  router.push(`/chat/${session.id}`);
};
```

### 6. Fix Search Button

The Search button should open a command palette / search dialog.

**In `search-button.tsx`:**

```typescript
// Open search dialog (already exists at components/search/)
const handleSearch = () => {
  // Use the SearchDialog from components/search/
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
};
```

Or wire to the `SearchDialog` component at `apps/app/app/(authenticated)/components/search/`.

### 7. Favorites System

**Database:** Add `isFavorite` boolean to `agentSessions` table, or use a `sessionFavorites` junction table.

**Simpler approach** - add to sessions router:

```typescript
// In sessions.router.ts
toggleFavorite: protectedProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const [session] = await db.select().from(agentSessions)
      .where(eq(agentSessions.id, input.sessionId)).limit(1);
    await db.update(agentSessions)
      .set({ isFavorite: !session.isFavorite })
      .where(eq(agentSessions.id, input.sessionId));
  }),
```

**In ChatItem:** Wire the "Add to favorites" dropdown action to the mutation. Show a star icon for favorited items.

### 8. Wire ChatItem Dropdown Actions

Currently all dropdown actions in `chat-item.tsx` are non-functional. Wire them:

| Action          | Implementation                                          |
| --------------- | ------------------------------------------------------- |
| Share           | Copy link (already works)                               |
| Rename          | `sessions.update({ title })` mutation with inline input |
| Favorite        | `sessions.toggleFavorite` mutation                      |
| Open in new tab | `window.open` (already works)                           |
| Archive         | `sessions.update({ status: "archived" })`               |
| Delete          | `sessions.delete` mutation with confirmation dialog     |

---

## Components to Create/Modify

| Component             | Action                                                   | Path                          |
| --------------------- | -------------------------------------------------------- | ----------------------------- |
| `index.tsx`           | Modify: remove dummy data, add logo, fetch real sessions | `sidebar/index.tsx`           |
| `nav-section.tsx`     | Modify: remove Knowledge + Builder                       | `sidebar/nav-section.tsx`     |
| `chat-item.tsx`       | Modify: wire dropdown actions to tRPC                    | `sidebar/chat-item.tsx`       |
| `filter-panel.tsx`    | Create: filter/sort panel                                | `sidebar/filter-panel.tsx`    |
| `new-task-button.tsx` | Modify: create real session                              | `sidebar/new-task-button.tsx` |
| `search-button.tsx`   | Modify: open search dialog                               | `sidebar/search-button.tsx`   |
| `session-groups.tsx`  | Create: grouped session list by date                     | `sidebar/session-groups.tsx`  |

---

## Key File Paths

| Purpose                 | Path                                                                  |
| ----------------------- | --------------------------------------------------------------------- |
| Sidebar root            | `apps/app/app/(authenticated)/components/sidebar/index.tsx`           |
| Nav section             | `apps/app/app/(authenticated)/components/sidebar/nav-section.tsx`     |
| Chat item               | `apps/app/app/(authenticated)/components/sidebar/chat-item.tsx`       |
| New task button         | `apps/app/app/(authenticated)/components/sidebar/new-task-button.tsx` |
| Search button           | `apps/app/app/(authenticated)/components/sidebar/search-button.tsx`   |
| Footer                  | `apps/app/app/(authenticated)/components/sidebar/sidebar-footer.tsx`  |
| Sessions router         | `apps/app/lib/trpc/routers/sessions.router.ts`                        |
| Sessions schema         | `packages/database/src/schema/sessions.ts`                            |
| Search dialog           | `apps/app/app/(authenticated)/components/search/`                     |
| Knowledge page (DELETE) | `apps/app/app/(authenticated)/knowledge/`                             |
| Builder page (DELETE)   | `apps/app/app/(authenticated)/website-builder/`                       |

---

## Testing

1. **No dummy data**: Sidebar should show real sessions from DB (or empty state)
2. **Logo visible**: Rubic logo/icon at top of sidebar
3. **Knowledge/Builder gone**: No Knowledge or Builder nav items
4. **New task**: Click New Task → creates session → navigates to `/chat/[id]`
5. **Search**: Click Search → opens search dialog (Cmd+K)
6. **Filter**: Click filter → can toggle favorites, filter by type
7. **Favorites**: Star a session → appears with star icon → filter shows only favorites
8. **Rename**: Click Rename → inline edit → saves to DB
9. **Delete**: Click Delete → confirmation → removes from sidebar
10. **Grouping**: Sessions grouped by Today, Yesterday, Last 7 days, Older

## Priority Order

1. Remove Knowledge + Builder nav items + delete page directories
2. Add logo placeholder
3. Replace dummy chats with real sessions from `sessions.list` tRPC query
4. Group sessions by date
5. Wire New Task button to session creation
6. Wire Search button to search dialog
7. Add filter panel
8. Wire all ChatItem dropdown actions
9. Implement favorites system
