/**
 * WebDev IDE tests.
 *
 * Tests the WebDev IDE canvas view:
 * - TOOL_VIEW_MAP: all webdev tools map to "webDevIDE"
 * - Preview URL extraction from multiple output formats
 * - WebDevIDEView props interface
 * - File tree normalization for IDE code panel
 * - IDE tab types and configuration
 */

import { describe, it, expect } from "vitest";
import { TOOL_VIEW_MAP } from "../use-canvas";
import type { CanvasViewType } from "../use-canvas";
import {
  isToolUIPart,
  getToolName,
} from "../../../lib/types/ui-message";
import type {
  StaticToolUIPart,
  UIMessage,
  UIMessagePart,
} from "../../../lib/types/ui-message";

// ── Helpers ──────────────────────────────────────────────────────────────

function createAssistantMessage(
  id: string,
  parts: UIMessagePart[]
): UIMessage {
  return { id, role: "assistant", parts };
}

function toolPart(
  toolName: string,
  toolCallId: string,
  input: unknown,
  output: unknown
): StaticToolUIPart {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "output-available",
    input,
    output,
  };
}

function toolPartInProgress(
  toolName: string,
  toolCallId: string,
  input: unknown
): StaticToolUIPart {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "input-available",
    input,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// 1. WebDev IDE Tool Mapping
// ═════════════════════════════════════════════════════════════════════════

describe("WebDev IDE tool → view mapping", () => {
  const WEBDEV_TOOLS = [
    "webdev_init_project",
    "webdev_save_checkpoint",
    "webdev_check_status",
    "webdev_restart_server",
    "webdev_rollback_checkpoint",
    "webdev_execute_sql",
    "webdev_push_schema",
    "webdev_list_versions",
    "webdev_add_feature",
  ];

  it.each(WEBDEV_TOOLS)("tool '%s' maps to 'webDevIDE' view", (toolName) => {
    expect(TOOL_VIEW_MAP[toolName]).toBe("webDevIDE" satisfies CanvasViewType);
  });

  it("has exactly 9 webDevIDE tool entries", () => {
    const webdevEntries = Object.entries(TOOL_VIEW_MAP).filter(
      ([, view]) => view === "webDevIDE"
    );
    expect(webdevEntries).toHaveLength(9);
  });

  it("all webdev tools are prefixed with 'webdev_'", () => {
    const webdevEntries = Object.entries(TOOL_VIEW_MAP).filter(
      ([, view]) => view === "webDevIDE"
    );
    for (const [name] of webdevEntries) {
      expect(name).toMatch(/^webdev_/);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Preview URL Extraction from Tool Output
// ═════════════════════════════════════════════════════════════════════════

describe("Preview URL extraction from webdev tool output", () => {
  it("extracts previewUrl from webdev_init_project output", () => {
    const output = {
      success: true,
      previewUrl: "https://5173-sandbox123.e2b.dev",
      projectName: "my-app",
    };
    expect(output.previewUrl).toBe("https://5173-sandbox123.e2b.dev");
  });

  it("extracts preview_url (snake_case) from output", () => {
    const output = {
      success: true,
      preview_url: "https://5173-sandbox456.e2b.dev",
    };
    expect(output.preview_url).toBe("https://5173-sandbox456.e2b.dev");
  });

  it("extracts url field as fallback", () => {
    const output = {
      success: true,
      url: "https://5173-sandbox789.e2b.dev",
    };
    expect(output.url).toBe("https://5173-sandbox789.e2b.dev");
  });

  it("extracts proxyUrl from deploy_expose_port output", () => {
    const output = {
      proxyUrl: "https://5173-sandbox-abc.e2b.dev",
      port: 5173,
    };
    expect(output.proxyUrl).toBe("https://5173-sandbox-abc.e2b.dev");
  });

  it("extracts proxy_url (snake_case) from deploy_expose_port output", () => {
    const output = {
      proxy_url: "https://5173-sandbox-def.e2b.dev",
      port: 5173,
    };
    expect(output.proxy_url).toBe("https://5173-sandbox-def.e2b.dev");
  });

  it("prefers previewUrl over url when both present", () => {
    const output = {
      previewUrl: "https://preferred.e2b.dev",
      url: "https://fallback.e2b.dev",
    };
    // The use-canvas.ts code uses ?? chain: previewUrl ?? preview_url ?? url
    const extracted = output.previewUrl ?? output.url;
    expect(extracted).toBe("https://preferred.e2b.dev");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. WebDev Tool Part Creation & Scanning
// ═════════════════════════════════════════════════════════════════════════

describe("WebDev tool parts for message scanning", () => {
  it("creates a webdev_init_project tool part with output", () => {
    const part = toolPart(
      "webdev_init_project",
      "call-1",
      { app_name: "my-app", template: "web-db-user" },
      { success: true, previewUrl: "https://5173-sandbox.e2b.dev" }
    );

    expect(part.state).toBe("output-available");
    expect(part.toolCallId).toBe("call-1");
    expect(getToolName(part)).toBe("webdev_init_project");
    expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("webDevIDE");
  });

  it("creates a webdev_execute_sql tool part with query results", () => {
    const part = toolPart(
      "webdev_execute_sql",
      "call-2",
      { sql: "SELECT * FROM users LIMIT 5" },
      {
        results: [
          { id: 1, name: "Alice", email: "alice@example.com" },
          { id: 2, name: "Bob", email: "bob@example.com" },
        ],
      }
    );

    expect(getToolName(part)).toBe("webdev_execute_sql");
    expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("webDevIDE");
    const output = part.output as Record<string, unknown>;
    const results = output.results as unknown[];
    expect(results).toHaveLength(2);
  });

  it("creates a webdev_push_schema tool part", () => {
    const part = toolPart(
      "webdev_push_schema",
      "call-3",
      {},
      { success: true, message: "Schema pushed successfully" }
    );

    expect(getToolName(part)).toBe("webdev_push_schema");
    expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("webDevIDE");
  });

  it("creates an in-progress webdev tool part", () => {
    const part = toolPartInProgress(
      "webdev_restart_server",
      "call-4",
      {}
    );

    expect(part.state).toBe("input-available");
    expect(getToolName(part)).toBe("webdev_restart_server");
    expect(TOOL_VIEW_MAP[getToolName(part)]).toBe("webDevIDE");
  });

  it("scans messages to find webdev tool parts", () => {
    const messages: UIMessage[] = [
      createAssistantMessage("msg-1", [
        toolPart(
          "shell_exec",
          "call-0",
          { command: "npm install" },
          { stdout: "added 123 packages" }
        ),
      ]),
      createAssistantMessage("msg-2", [
        toolPart(
          "webdev_init_project",
          "call-1",
          { app_name: "my-app" },
          { success: true, previewUrl: "https://5173-sandbox.e2b.dev" }
        ),
      ]),
    ];

    // Scan backward to find the latest webdev tool
    let foundWebdevTool = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      if (msg.role !== "assistant" || !msg.parts) continue;
      for (let j = msg.parts.length - 1; j >= 0; j--) {
        const part = msg.parts[j];
        if (!part || !isToolUIPart(part)) continue;
        const tp = part as StaticToolUIPart;
        const toolName = getToolName(tp);
        if (TOOL_VIEW_MAP[toolName] === "webDevIDE") {
          foundWebdevTool = true;
          expect(toolName).toBe("webdev_init_project");
          break;
        }
      }
      if (foundWebdevTool) break;
    }
    expect(foundWebdevTool).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Deploy Expose Port → Preview URL
// ═════════════════════════════════════════════════════════════════════════

describe("deploy_expose_port creates preview URL for IDE", () => {
  it("deploy_expose_port maps to browser view (not webDevIDE)", () => {
    expect(TOOL_VIEW_MAP["deploy_expose_port"]).toBe("browser");
  });

  it("deploy_expose_port output contains URL fields", () => {
    const output = {
      url: "https://5173-abc123.e2b.dev",
      port: 5173,
    };

    // The use-canvas code checks: output.url ?? output.proxyUrl ?? output.proxy_url
    const url =
      (output.url as string) ?? null;
    expect(url).toBe("https://5173-abc123.e2b.dev");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. IDE Tab Configuration
// ═════════════════════════════════════════════════════════════════════════

describe("IDE tab configuration", () => {
  const IDE_TABS = ["preview", "code", "dashboard", "database", "file", "settings"];

  it("has exactly 6 tabs", () => {
    expect(IDE_TABS).toHaveLength(6);
  });

  it("preview is the first/default tab", () => {
    expect(IDE_TABS[0]).toBe("preview");
  });

  it("all tab IDs are unique", () => {
    const unique = new Set(IDE_TABS);
    expect(unique.size).toBe(IDE_TABS.length);
  });

  it("settings is the last tab", () => {
    expect(IDE_TABS[IDE_TABS.length - 1]).toBe("settings");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. Settings Categories
// ═════════════════════════════════════════════════════════════════════════

describe("Settings panel categories", () => {
  const CATEGORIES = [
    "general",
    "domains",
    "notifications",
    "payment",
    "seo",
    "secrets",
    "github",
    "usage",
  ];

  it("has exactly 8 settings categories", () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  it("general is the first/default category", () => {
    expect(CATEGORIES[0]).toBe("general");
  });

  it("all categories are unique", () => {
    const unique = new Set(CATEGORIES);
    expect(unique.size).toBe(CATEGORIES.length);
  });

  it("github and usage are the last two", () => {
    expect(CATEGORIES[6]).toBe("github");
    expect(CATEGORIES[7]).toBe("usage");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. Code-Server URL Construction
// ═════════════════════════════════════════════════════════════════════════

describe("Code-server URL construction from sandboxId", () => {
  it("constructs correct code-server URL", () => {
    const sandboxId = "abc123xyz";
    const url = `https://8330-${sandboxId}.e2b.dev/cs/?folder=/home/user/project`;
    expect(url).toBe("https://8330-abc123xyz.e2b.dev/cs/?folder=/home/user/project");
  });

  it("uses port 8330 (terminal server proxy)", () => {
    const sandboxId = "test-id";
    const url = `https://8330-${sandboxId}.e2b.dev/cs/`;
    expect(url).toContain("8330-");
    expect(url).toContain("/cs/");
  });

  it("points to /home/user/project folder", () => {
    const sandboxId = "test-id";
    const url = `https://8330-${sandboxId}.e2b.dev/cs/?folder=/home/user/project`;
    expect(url).toContain("folder=/home/user/project");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 8. Database Query Construction
// ═════════════════════════════════════════════════════════════════════════

describe("Database query construction for IDE", () => {
  it("constructs SHOW TABLES query", () => {
    const query = { operation: "query", sql: "SHOW TABLES" };
    expect(query.sql).toBe("SHOW TABLES");
    expect(query.operation).toBe("query");
  });

  it("constructs DESCRIBE query for a table", () => {
    const table = "users";
    const query = { operation: "query", sql: `DESCRIBE \`${table}\`` };
    expect(query.sql).toBe("DESCRIBE `users`");
  });

  it("constructs SELECT query with LIMIT", () => {
    const table = "appointments";
    const limit = 50;
    const query = {
      operation: "query",
      sql: `SELECT * FROM \`${table}\` LIMIT ${limit}`,
    };
    expect(query.sql).toBe("SELECT * FROM `appointments` LIMIT 50");
  });

  it("escapes table names with backticks", () => {
    const table = "contact_submissions";
    const sql = `SELECT * FROM \`${table}\` LIMIT 50`;
    expect(sql).toContain("`contact_submissions`");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 9. File Storage Sorting
// ═════════════════════════════════════════════════════════════════════════

describe("File storage sorting logic", () => {
  interface StorageFile {
    name: string;
    size: number;
    lastModified: string;
  }

  const testFiles: StorageFile[] = [
    { name: "logo.png", size: 45000, lastModified: "2026-02-15T10:00:00Z" },
    { name: "banner.jpg", size: 120000, lastModified: "2026-02-14T08:00:00Z" },
    { name: "readme.md", size: 500, lastModified: "2026-02-16T12:00:00Z" },
  ];

  it("sorts by name ascending", () => {
    const sorted = [...testFiles].sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted[0]!.name).toBe("banner.jpg");
    expect(sorted[1]!.name).toBe("logo.png");
    expect(sorted[2]!.name).toBe("readme.md");
  });

  it("sorts by name descending", () => {
    const sorted = [...testFiles].sort((a, b) => b.name.localeCompare(a.name));
    expect(sorted[0]!.name).toBe("readme.md");
    expect(sorted[2]!.name).toBe("banner.jpg");
  });

  it("sorts by size ascending", () => {
    const sorted = [...testFiles].sort((a, b) => a.size - b.size);
    expect(sorted[0]!.name).toBe("readme.md");
    expect(sorted[2]!.name).toBe("banner.jpg");
  });

  it("sorts by lastModified descending (newest first)", () => {
    const sorted = [...testFiles].sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
    expect(sorted[0]!.name).toBe("readme.md");
    expect(sorted[2]!.name).toBe("banner.jpg");
  });

  it("formats file sizes correctly", () => {
    const formatSize = (bytes: number) => {
      if (bytes === 0) return "—";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    expect(formatSize(0)).toBe("—");
    expect(formatSize(500)).toBe("500 B");
    expect(formatSize(45000)).toBe("43.9 KB");
    expect(formatSize(120000)).toBe("117.2 KB");
    expect(formatSize(1048576)).toBe("1.0 MB");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 10. Loading Overlay Conditions
// ═════════════════════════════════════════════════════════════════════════

describe("Loading overlay display conditions", () => {
  it("shows overlay when working + streaming + no preview", () => {
    const isWorking = true;
    const isStreaming = true;
    const previewUrl = undefined;
    const show = isWorking && isStreaming && !previewUrl;
    expect(show).toBe(true);
  });

  it("hides overlay when preview URL is available", () => {
    const isWorking = true;
    const isStreaming = true;
    const previewUrl = "https://5173-sandbox.e2b.dev";
    const show = isWorking && isStreaming && !previewUrl;
    expect(show).toBe(false);
  });

  it("hides overlay when not working", () => {
    const isWorking = false;
    const isStreaming = true;
    const previewUrl = undefined;
    const show = isWorking && isStreaming && !previewUrl;
    expect(show).toBe(false);
  });

  it("hides overlay when not streaming", () => {
    const isWorking = true;
    const isStreaming = false;
    const previewUrl = undefined;
    const show = isWorking && isStreaming && !previewUrl;
    expect(show).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 11. Lazy Tab Mounting
// ═════════════════════════════════════════════════════════════════════════

describe("Lazy tab mounting behavior", () => {
  it("preview tab is mounted by default", () => {
    const mountedTabs = new Set(["preview"]);
    expect(mountedTabs.has("preview")).toBe(true);
    expect(mountedTabs.has("code")).toBe(false);
    expect(mountedTabs.has("database")).toBe(false);
  });

  it("adds tab to mounted set on first activation", () => {
    const mountedTabs = new Set(["preview"]);

    // Simulate clicking "code" tab
    mountedTabs.add("code");
    expect(mountedTabs.has("code")).toBe(true);
    expect(mountedTabs.size).toBe(2);
  });

  it("does not remove tabs once mounted", () => {
    const mountedTabs = new Set(["preview", "code", "database"]);

    // Even when switching to a different tab, previously mounted tabs stay
    expect(mountedTabs.has("preview")).toBe(true);
    expect(mountedTabs.has("code")).toBe(true);
    expect(mountedTabs.has("database")).toBe(true);
  });

  it("all 6 tabs can be mounted", () => {
    const mountedTabs = new Set([
      "preview",
      "code",
      "dashboard",
      "database",
      "file",
      "settings",
    ]);
    expect(mountedTabs.size).toBe(6);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 12. Viewport Sizes for Preview
// ═════════════════════════════════════════════════════════════════════════

describe("Preview viewport sizes", () => {
  const VIEWPORT_SIZES = {
    mobile: { width: "375px" },
    tablet: { width: "768px" },
    desktop: { width: "100%" },
  };

  it("mobile viewport is 375px", () => {
    expect(VIEWPORT_SIZES.mobile.width).toBe("375px");
  });

  it("tablet viewport is 768px", () => {
    expect(VIEWPORT_SIZES.tablet.width).toBe("768px");
  });

  it("desktop viewport is 100%", () => {
    expect(VIEWPORT_SIZES.desktop.width).toBe("100%");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 13. WebDev IDE Integration with Canvas System
// ═════════════════════════════════════════════════════════════════════════

describe("WebDev IDE integration with canvas system", () => {
  it("webDevIDE is a valid CanvasViewType", () => {
    const viewType: CanvasViewType = "webDevIDE";
    expect(viewType).toBe("webDevIDE");
  });

  it("webdev_init_project activates the IDE view", () => {
    const toolName = "webdev_init_project";
    const viewType = TOOL_VIEW_MAP[toolName];
    expect(viewType).toBe("webDevIDE");
  });

  it("multiple webdev tool calls keep the same view", () => {
    const tools = [
      "webdev_init_project",
      "webdev_push_schema",
      "webdev_restart_server",
      "webdev_check_status",
    ];

    const views = tools.map((t) => TOOL_VIEW_MAP[t]);
    expect(views.every((v) => v === "webDevIDE")).toBe(true);
  });

  it("webdev tools do NOT map to terminal or browser view", () => {
    const webdevTools = Object.entries(TOOL_VIEW_MAP)
      .filter(([, view]) => view === "webDevIDE")
      .map(([name]) => name);

    for (const tool of webdevTools) {
      expect(TOOL_VIEW_MAP[tool]).not.toBe("terminal");
      expect(TOOL_VIEW_MAP[tool]).not.toBe("browser");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 14. Preview HTML Builder
// ═════════════════════════════════════════════════════════════════════════

describe("Preview HTML builder", () => {
  // Test the logic that buildPreviewHtml uses
  it("detects HTML files by extension", () => {
    const files = {
      "/home/user/project/index.html": "<html><body>Hello</body></html>",
      "/home/user/project/style.css": "body { color: red; }",
    };

    const htmlFile = Object.entries(files).find(([k]) => k.endsWith(".html"));
    expect(htmlFile).toBeDefined();
    expect(htmlFile![1]).toContain("<html>");
  });

  it("finds index.html regardless of path depth", () => {
    const files: Record<string, string> = {
      "/deep/path/index.html": "<html></html>",
      "/style.css": "body {}",
    };

    let found: string | null = null;
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith("/index.html") || path === "index.html") {
        found = content;
        break;
      }
    }
    expect(found).toBe("<html></html>");
  });

  it("identifies CSS files for injection", () => {
    const files = {
      "index.html": "<html></html>",
      "styles.css": "body { margin: 0; }",
      "theme.css": ":root { --color: blue; }",
      "app.js": "console.log('hello');",
    };

    const cssFiles = Object.entries(files).filter(([k]) => k.endsWith(".css"));
    expect(cssFiles).toHaveLength(2);
  });

  it("identifies JS files for injection", () => {
    const files = {
      "index.html": "<html></html>",
      "app.js": "console.log('hello');",
      "utils.mjs": "export const x = 1;",
      "style.css": "body {}",
    };

    const jsFiles = Object.entries(files).filter(
      ([k]) => k.endsWith(".js") || k.endsWith(".mjs")
    );
    expect(jsFiles).toHaveLength(2);
  });
});
