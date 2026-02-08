## Diagnosis: The Two Core Problems

You are facing two distinct but related issues that are causing your UI to fail. I have analyzed your code and the screenshot, and here is the definitive diagnosis.

### Problem 1: All Tools Render as a Generic Box

This is happening because your `tool-registry.tsx` is configured for a completely different set of tools than what your AI backend is actually sending. 

**The Evidence:**

1.  **Your `tool-registry.tsx` expects tools like:** `web_search`, `code_interpreter`, `shell_command`, `file_read`, etc. It maps these names to specialized renderers like `<WebSearchEnhanced>`, `<CodeBlockEnhanced>`, and `<TerminalOutputEnhanced>`.
2.  **Your AI backend is sending tools named:** `Read data`, `CPU stats`, `File validation`, `Find and replace`, etc. (as seen in your screenshot).

Your `getRenderer(toolName)` function tries to find a renderer for `"Read data"` in its map, fails, and correctly falls back to the default `GenericTool` renderer. This happens for every single tool, which is why you see a long list of identical generic boxes.

**This is not a bug in the code, but a fundamental mismatch in the data contract between your frontend and backend.**

### Problem 2: Components are Static (No Animations)

This is a classic monorepo CSS configuration issue. Your components are in a separate package (`packages/@repo/ai`), but your main application's Tailwind CSS configuration is not watching that package for changes.

**The Evidence:**

1.  Your `tool-card.tsx` uses Tailwind animation classes like `animate-spin` (for the loader) and `animate-[shimmer_...]` (for the progress bar).
2.  Because your `tailwind.config.js` is not configured to scan the `@repo/ai` package, Tailwind's JIT compiler doesn't see these classes being used and **purges them** from the final CSS bundle in production builds.
3.  The browser loads the CSS, the classes are missing, and therefore no animations play. The components appear static because their animation styles were never included in the first place.

--- 

## The Fix: A Two-Part Solution

Here is the step-by-step guide to fix both issues permanently.

### Part 1: Fix the Tool Rendering

You must make your `tool-registry.tsx` aware of your actual tool names.

**Step 1: Update `tool-registry.tsx`**

Replace the `defaultRenderers` map with one that uses your actual tool names. You need to decide which renderer is appropriate for each of your tools.

```typescript
// packages/@repo/ai/components/tools/tool-registry.tsx

const defaultRenderers: Record<string, ToolRenderer> = {
  // --- MAP YOUR ACTUAL TOOLS HERE ---

  // Example Mapping:
  "Read data": CodeBlockEnhanced as ToolRenderer,       // Assuming it shows data, CodeBlock is good for JSON
  "CPU stats": CodeBlockEnhanced as ToolRenderer,       // Also likely JSON/text
  "File validation": FilePreview as ToolRenderer,
  "File write": FilePreview as ToolRenderer,
  "File read": FilePreview as ToolRenderer,
  "Find and replace": CodeBlockEnhanced as ToolRenderer, // Show the diff in a code block

  // Search tools
  "Find HTTPS query": WebSearchEnhanced as ToolRenderer,
  "Find Firefox query": WebSearchEnhanced as ToolRenderer,

  // Image Generation
  "Generate image": ImageResult as ToolRenderer,

  // Deployment
  "Deploy result": DeployResult as ToolRenderer,

  // --- Add all your other 30+ tools here ---
  // For any tool you're unsure about, you can start with GenericTool
  "Retrieve widgets": GenericTool as ToolRenderer,
  "Retrieve attendance": GenericTool as ToolRenderer,

  // IMPORTANT: Keep the fallback
  "*": GenericTool,
};
```

**Step 2: Use a Tool Name Normalizer (Recommended)**

To make this more robust, I strongly recommend normalizing the tool names. This prevents issues with casing or spacing. Update your `getRenderer` function:

```typescript
// packages/@repo/ai/components/tools/tool-registry.tsx

function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_');
}

// ... in your ToolRegistryProvider ...
const getRenderer = (toolName: string): ToolRenderer => {
  const normalizedName = normalizeToolName(toolName);
  // First, try to match the normalized name
  if (renderers[normalizedName]) {
    return renderers[normalizedName];
  }
  // Then, try the original name for backwards compatibility
  if (renderers[toolName]) {
    return renderers[toolName];
  }
  // Fallback to generic
  return renderers["*"] ?? GenericTool;
};
```

Now, you can define your map with clean, normalized names (`read_data`, `cpu_stats`, etc.), and it will correctly match the tool names coming from your backend.

### Part 2: Fix the Animations

**Step 1: Update `tailwind.config.js`**

You need to tell Tailwind to scan your `@repo/ai` package. Find the `tailwind.config.js` in your main web application (e.g., `apps/web/tailwind.config.js`) and update the `content` array.

```javascript
// apps/web/tailwind.config.js

const path = require('path');

module.exports = {
  // ... other config
  content: [
    // Your app's pages and components
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",

    // --- ADD THIS LINE --- 
    // Include all files from your shared UI package
    path.join(path.dirname(require.resolve('@repo/ai')), '**/*.{js,ts,jsx,tsx}'),
  ],
  // ... other config
};
```

This line programmatically finds the location of your `@repo/ai` package in `node_modules` and tells Tailwind to scan all of its files for CSS classes.

**Step 2: Restart Your Development Server**

After saving the config file, you **must** restart your Next.js development server (`pnpm dev` or `npm run dev`). The Tailwind compiler needs to rebuild its internal class list with the new content source.

Once you restart, the animations will work correctly.

---

By implementing these two fixes, your tool renderers will display correctly, and all animations will play as intended, providing the rich, interactive experience you' you expect from-the-future user experience you're looking for.
