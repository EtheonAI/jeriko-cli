# parts — Testing Rules

## What This Is
Message part renderers: text, tool invocations, reasoning, source URLs.

## What to Test

### TextPart (P0)
1. Plain text → rendered as text
2. Markdown → rendered with formatting (bold, italic, code, lists)
3. Code blocks → syntax highlighted with language tag
4. Links → clickable, open in new tab
5. XSS attempt → sanitized (no script execution)
6. Empty text → graceful handling

### ToolPart (P0)
1. Delegates to tool-registry for correct renderer
2. Pending state → loading indicator
3. Complete state → result displayed
4. Error state → error message displayed
5. Unknown tool → GenericTool fallback

### ReasoningPart (P1)
1. Thinking content → collapsible block
2. Collapsed by default
3. Click to expand/collapse
4. Long reasoning → scrollable

### SourcePart (P2)
1. Source URLs displayed as links
2. Favicon or domain shown
3. Click opens URL

## Existing Tests
- `__tests__/` directory
