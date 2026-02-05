# Tool UI Components - Enhanced Renderers

## Overview

The enhanced tool UI components provide production-ready visualizations for AI agent tool executions with animations, state transitions, and rich interactive features. These components are inspired by Manus and implement best practices from the tool-ui reference library.

## CSS Animations (`tool-animations.css`)

Import in your global styles:

```css
@import "@repo/ai/components/tools/tool-animations.css";
```

### Available Animations

| Class                 | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `.shimmer`            | Active/loading text highlight animation                         |
| `.shimmer-invert`     | Inverted shimmer for dark backgrounds                           |
| `.spinner`            | Loading spinner (0.7s rotation)                                 |
| `.typing-cursor`      | Blinking cursor for streaming text                              |
| `.skeleton`           | Placeholder loading animation                                   |
| `.tool-card`          | State transitions (streaming, executing, completed, error)      |
| `.status-badge`       | Animated state indicators (pending, running, completed, failed) |
| `.connector-line`     | Step progression lines                                          |
| `.expandable-content` | Smooth height transitions                                       |
| `.check-draw`         | SVG checkmark path animation                                    |

### Keyframes

- `shimmer` - Background gradient sweep
- `spring-bounce` - Bouncy scale animation for checkmarks
- `check-draw` - SVG stroke animation
- `progress-pulse` - 100% completion celebration
- `glow-pulse` - Success glow effect
- `fade-in` / `fade-in-up` / `fade-in-scale` - Entry animations
- `slide-in-from-right` / `slide-in-from-left` - Directional transitions
- `blur-in` - Soft appearance
- `blink` - Cursor blink

### ANSI Terminal Colors

Full ANSI color support for terminal output:

- Standard: `.ansi-black` through `.ansi-white`
- Bright: `.ansi-bright-black` through `.ansi-bright-white`
- Styles: `.ansi-bold`, `.ansi-dim`, `.ansi-italic`, `.ansi-underline`

---

## Enhanced Components

### 1. AgentActivityTracker

Real-time visualization of agent execution with planning phases, tool loops, and progress.

```tsx
import { AgentActivityTracker, type ActivityStep } from "@repo/ai/components/tools";

<AgentActivityTracker
  steps={activitySteps}
  currentStepId="step-123"
  elapsedTime={5000}
  iterations={2}
  isActive={true}
  onPause={() => {}}
  onCancel={() => {}}
  compact={false}
/>;
```

**Features:**

- Planning phase visualization
- Tool execution loops with state changes
- Progress indicators with animations
- Elapsed time and iteration count
- Pause/resume/cancel controls
- Compact mode for inline display

### 2. CodeBlockEnhanced

Syntax-highlighted code execution with line numbers and streaming support.

```tsx
import { CodeBlockEnhanced } from "@repo/ai/components/tools";
```

**Features:**

- Custom syntax highlighting (no external deps)
- Language detection (Python, JS/TS, Bash, Go, Rust, C, Java)
- Line numbers with highlighting
- Collapsible code/output sections
- Copy to clipboard
- Streaming code animation
- Execution metrics (time, memory)
- Multi-language support

### 3. TerminalOutputEnhanced

Shell command results with ANSI color support.

```tsx
import { TerminalOutputEnhanced } from "@repo/ai/components/tools";
```

**Features:**

- Full ANSI color code parsing
- Streaming output support
- Collapsible long output (20+ lines)
- Copy command and output separately
- Exit code with status indicators (success/failure)
- Real-time elapsed time
- Traffic light window chrome

### 4. BrowserViewerEnhanced

Screenshot display with zoom/pan and fullscreen modal.

```tsx
import { BrowserViewerEnhanced } from "@repo/ai/components/tools";
```

**Features:**

- Interactive screenshot with zoom/pan
- Fullscreen modal view (ESC to close)
- Click/action overlays
- URL bar with navigation indicators
- Loading states with progress
- Console output display (collapsible)
- Browser chrome styling

### 5. WebSearchEnhanced

Expandable search results with rich previews.

```tsx
import { WebSearchEnhanced } from "@repo/ai/components/tools";
```

**Features:**

- Animated search progress
- Expandable result cards with full content
- Source quality indicators (score badges)
- Copy citation button
- Related searches
- Quick answer snippets
- Favicon integration
- Published date formatting

### 6. PlanToolEnhanced

Rich planning visualization with timeline and progress.

```tsx
import { PlanToolEnhanced } from "@repo/ai/components/tools";
```

**Features:**

- Animated timeline view
- Collapsible phases with tasks
- Progress bar with percentage
- Time estimates per phase
- Phase status animations
- Confidence indicators
- Task dependencies

---

## Tool Registry

The tool registry maps tool names to renderers. Enhanced renderers are now the default:

```tsx
// packages/ai/components/tools/tool-registry.tsx

const defaultRenderers = {
  // Web search (enhanced)
  web_search: WebSearchEnhanced,
  search_web: WebSearchEnhanced,

  // Code execution (enhanced)
  code_execute: CodeBlockEnhanced,
  python: CodeBlockEnhanced,
  javascript: CodeBlockEnhanced,

  // Shell/Terminal (enhanced)
  shell_exec: TerminalOutputEnhanced,
  bash: TerminalOutputEnhanced,

  // Browser (enhanced)
  browser_navigate: BrowserViewerEnhanced,
  browser_click: BrowserViewerEnhanced,
  browser_screenshot: BrowserViewerEnhanced,

  // Planning (enhanced)
  plan: PlanToolEnhanced,

  // Fallback
  "*": GenericTool,
};
```

---

## Integration Example

### Chat Page Integration

```tsx
// In chat-page-client.tsx

import { AgentActivityTracker, type ActivityStep } from "@repo/ai/components/tools";

// Derive activity steps from messages
const activitySteps = useMemo<ActivityStep[]>(() => {
  const steps: ActivityStep[] = [];
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  if (!latestAssistant) return steps;

  for (const part of latestAssistant.parts) {
    if (part.type === "tool-invocation") {
      steps.push({
        id: part.toolCallId,
        type: "tool",
        label: formatToolName(part.toolName),
        toolName: part.toolName,
        status: getStatus(part.state),
      });
    }
  }
  return steps;
}, [messages]);

// Render in footer
{
  showActivityTracker && (
    <AgentActivityTracker
      steps={activitySteps}
      currentStepId={currentStepId}
      isActive={status === "streaming"}
      onCancel={stop}
      compact
    />
  );
}
```

---

## State Machine

Tool states follow this progression:

```
input-streaming → input-available → output-available/output-error
                                  ↓
                           approval-requested → approved/rejected
```

Each state has corresponding visual treatment:

- `input-streaming`: Shimmer animation, typing cursor
- `input-available`: Spinner, "Executing..." message
- `output-available`: Green checkmark, spring bounce animation
- `output-error`: Red X, error highlight
- `approval-requested`: Shield icon, approval buttons

---

## Best Practices

1. **Always import CSS**: Add `@import "@repo/ai/components/tools/tool-animations.css"` to global styles

2. **Respect reduced motion**: All animations use `motion-safe:` prefix for accessibility

3. **Use compact mode**: For inline progress (above input), use `compact={true}`

4. **Handle all states**: Each tool part can be in any state, handle gracefully

5. **Streaming support**: Use `.typing-cursor` for text being received

6. **Error display**: Always show errors prominently with red highlighting
