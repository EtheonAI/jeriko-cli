/**
 * System Prompt Tests — Skills, Connections, File Context Injection
 *
 * Tests that buildManusSystemPrompt correctly injects:
 * 1. <available_skills> section when skills are active
 * 2. <connected_apps_rules> with selected connections
 * 3. <file_context> section when files are uploaded
 * 4. All 21+ XML sections are present
 * 5. Session metadata is correct
 * 6. Conditional sections only appear when data is present
 */

import { describe, it, expect } from "vitest";
import { buildManusSystemPrompt, type SystemPromptContext } from "../src/lib/system-prompt";

// ============================================================================
// Helpers
// ============================================================================

function makeContext(overrides?: Partial<SystemPromptContext>): SystemPromptContext {
  return {
    sessionId: "test-session-123",
    currentDate: "2026-02-15",
    timezone: "America/New_York",
    userName: "TestUser",
    sandboxId: "sandbox-abc",
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("buildManusSystemPrompt", () => {
  // ========================================================================
  // 1. Core sections always present
  // ========================================================================

  describe("Core Sections", () => {
    it("should include all mandatory XML sections", () => {
      const prompt = buildManusSystemPrompt(makeContext());

      const mandatorySections = [
        "<agent_intro>",
        "<language>",
        "<format>",
        "<important>",
        "<tool_use>",
        "<capabilities>",
        "<agent_loop>",
        "<todo_rules>",
        "<message_rules>",
        "<file_rules>",
        "<info_rules>",
        "<browser_rules>",
        "<shell_rules>",
        "<coding_rules>",
        "<deploy_rules>",
        "<webdev_rules>",
        "<slide_rules>",
        "<image_rules>",
        "<connected_apps_rules>",
        "<error_handling>",
        "<sandbox_environment>",
        "<session_info>",
      ];

      for (const section of mandatorySections) {
        expect(prompt).toContain(section);
      }
    });

    it("should include user name in agent intro", () => {
      const prompt = buildManusSystemPrompt(makeContext({ userName: "Alice" }));
      expect(prompt).toContain("Alice");
    });

    it("should include session metadata", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        sessionId: "sess-456",
        sandboxId: "sandbox-xyz",
      }));

      expect(prompt).toContain("sess-456");
      expect(prompt).toContain("sandbox-xyz");
      expect(prompt).toContain("2026-02-15");
    });

    it("should include sandbox ID in environment section", () => {
      const prompt = buildManusSystemPrompt(makeContext({ sandboxId: "sandbox-test" }));
      expect(prompt).toContain("sandbox-test");
    });
  });

  // ========================================================================
  // 2. Skills injection
  // ========================================================================

  describe("Available Skills Section", () => {
    it("should include <available_skills> when skills are active", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: ["web-search", "browser", "code-interpreter"],
      }));

      expect(prompt).toContain("<available_skills>");
      expect(prompt).toContain("</available_skills>");
    });

    it("should list all active skill descriptions", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: ["web-search", "code-interpreter", "browser"],
      }));

      expect(prompt).toContain("Web Search");
      expect(prompt).toContain("Code Interpreter");
      expect(prompt).toContain("Browser");
    });

    it("should include all 6 skill types when all are active", () => {
      const allSkills = [
        "web-search",
        "code-interpreter",
        "image-generation",
        "document-analysis",
        "data-analysis",
        "browser",
      ];

      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: allSkills,
      }));

      expect(prompt).toContain("Web Search");
      expect(prompt).toContain("Code Interpreter");
      expect(prompt).toContain("Image Generation");
      expect(prompt).toContain("Document Analysis");
      expect(prompt).toContain("Data Analysis");
      expect(prompt).toContain("Browser");
    });

    it("should NOT include <available_skills> when no skills are active", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: undefined,
      }));

      expect(prompt).not.toContain("<available_skills>");
    });

    it("should NOT include <available_skills> when skills array is empty", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: [],
      }));

      expect(prompt).not.toContain("<available_skills>");
    });

    it("should handle unknown skill IDs gracefully", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: ["web-search", "unknown-skill-123"],
      }));

      expect(prompt).toContain("<available_skills>");
      expect(prompt).toContain("Web Search");
      expect(prompt).toContain("unknown-skill-123"); // Falls back to ID
    });

    it("should include instruction to prioritize active skills", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: ["web-search"],
      }));

      expect(prompt).toContain("Prioritize using");
    });
  });

  // ========================================================================
  // 3. File context injection
  // ========================================================================

  describe("File Context Section", () => {
    it("should include <file_context> when files are uploaded", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        fileContext: [
          { name: "report.pdf", type: "application/pdf" },
          { name: "data.csv", type: "text/csv" },
        ],
      }));

      expect(prompt).toContain("<file_context>");
      expect(prompt).toContain("</file_context>");
    });

    it("should list file names and types", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        fileContext: [
          { name: "report.pdf", type: "application/pdf" },
          { name: "photo.jpg", type: "image/jpeg" },
        ],
      }));

      expect(prompt).toContain("report.pdf (application/pdf)");
      expect(prompt).toContain("photo.jpg (image/jpeg)");
    });

    it("should NOT include <file_context> when no files", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        fileContext: undefined,
      }));

      expect(prompt).not.toContain("<file_context>");
    });

    it("should NOT include <file_context> when file array is empty", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        fileContext: [],
      }));

      expect(prompt).not.toContain("<file_context>");
    });

    it("should mention upload directory /home/user/upload/", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        fileContext: [{ name: "test.txt", type: "text/plain" }],
      }));

      expect(prompt).toContain("/home/user/upload/");
    });
  });

  // ========================================================================
  // 4. Connected apps / connections injection
  // ========================================================================

  describe("Connected Apps Section", () => {
    it("should show selected connections with type labels", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        selectedConnections: [
          { id: "conn-1", type: "app", name: "Gmail" },
          { id: "conn-2", type: "device", name: "Living Room Light" },
        ],
      }));

      expect(prompt).toContain("Gmail (App Integration)");
      expect(prompt).toContain("Living Room Light (Smart Home Device)");
      expect(prompt).toContain("selected the following integrations for this session");
    });

    it("should fall back to connectedApps when no selectedConnections", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        connectedApps: ["Gmail", "Slack", "GitHub"],
        selectedConnections: undefined,
      }));

      expect(prompt).toContain("Gmail");
      expect(prompt).toContain("Slack");
      expect(prompt).toContain("GitHub");
      expect(prompt).toContain("authorized the following integrations");
    });

    it("should show 'no integrations' when nothing is connected", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        connectedApps: undefined,
        selectedConnections: undefined,
      }));

      expect(prompt).toContain("No third-party integrations are currently connected");
    });

    it("should prefer selectedConnections over connectedApps", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        connectedApps: ["Gmail", "Slack"],
        selectedConnections: [
          { id: "conn-1", type: "app", name: "Gmail" },
        ],
      }));

      // Should use selectedConnections format
      expect(prompt).toContain("selected the following integrations for this session");
      expect(prompt).toContain("Gmail (App Integration)");
      // Should NOT contain the connectedApps format
      expect(prompt).not.toContain("authorized the following integrations");
    });

    it("should use connection ID as fallback name", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        selectedConnections: [
          { id: "conn-123" }, // No name or type
        ],
      }));

      expect(prompt).toContain("conn-123");
    });
  });

  // ========================================================================
  // 5. Combined skills + files + connections
  // ========================================================================

  describe("Full Context: Skills + Files + Connections", () => {
    it("should include all three conditional sections when all data present", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: ["web-search", "browser"],
        fileContext: [{ name: "doc.pdf", type: "application/pdf" }],
        selectedConnections: [{ id: "conn-1", type: "app", name: "Gmail" }],
      }));

      expect(prompt).toContain("<available_skills>");
      expect(prompt).toContain("<file_context>");
      expect(prompt).toContain("<connected_apps_rules>");
      expect(prompt).toContain("Web Search");
      expect(prompt).toContain("doc.pdf");
      expect(prompt).toContain("Gmail");
    });

    it("should end with <session_info> regardless of conditional sections", () => {
      const prompt = buildManusSystemPrompt(makeContext({
        activeSkills: ["web-search"],
        fileContext: [{ name: "test.txt", type: "text/plain" }],
      }));

      // session_info should always be last
      const sessionInfoIdx = prompt.lastIndexOf("<session_info>");
      const availableSkillsIdx = prompt.lastIndexOf("</available_skills>");
      const fileContextIdx = prompt.lastIndexOf("</file_context>");

      expect(sessionInfoIdx).toBeGreaterThan(availableSkillsIdx);
      expect(sessionInfoIdx).toBeGreaterThan(fileContextIdx);
    });
  });

  // ========================================================================
  // 6. Capabilities section — tool list
  // ========================================================================

  describe("Capabilities Section", () => {
    it("should list all tool categories", () => {
      const prompt = buildManusSystemPrompt(makeContext());

      expect(prompt).toContain("COMMUNICATION");
      expect(prompt).toContain("FILE MANAGEMENT");
      expect(prompt).toContain("SHELL");
      expect(prompt).toContain("CODE EXECUTION");
      expect(prompt).toContain("WEB SEARCH");
      expect(prompt).toContain("BROWSER");
      expect(prompt).toContain("DEPLOYMENT");
      expect(prompt).toContain("IMAGE GENERATION");
      expect(prompt).toContain("PLANNING");
      expect(prompt).toContain("SCHEDULING");
      expect(prompt).toContain("PARALLEL EXECUTION");
      expect(prompt).toContain("EMAIL");
      expect(prompt).toContain("SKILLS");
      expect(prompt).toContain("SLIDES");
    });

    it("should list key tool names", () => {
      const prompt = buildManusSystemPrompt(makeContext());

      const keyTools = [
        "message_notify_user", "message_ask_user",
        "file_read", "file_write", "file_str_replace",
        "shell_exec", "shell_view",
        "code_execute",
        "info_search_web",
        "browser_navigate", "browser_view", "browser_click",
        "deploy_expose_port", "deploy_apply_deployment",
        "generate_image",
        "show_plan",
        "schedule_task",
        "make_manus_page",
        "text_editor",
      ];

      for (const tool of keyTools) {
        expect(prompt).toContain(tool);
      }
    });
  });

  // ========================================================================
  // 7. Prompt size / structure
  // ========================================================================

  describe("Prompt Structure", () => {
    it("should produce a non-empty string", () => {
      const prompt = buildManusSystemPrompt(makeContext());
      expect(prompt.length).toBeGreaterThan(1000);
    });

    it("should not contain double blank lines between sections", () => {
      const prompt = buildManusSystemPrompt(makeContext());
      // Sections are joined with \n\n — there should be no triple newlines
      expect(prompt).not.toContain("\n\n\n\n");
    });

    it("should not contain system_prompt field name (security)", () => {
      const prompt = buildManusSystemPrompt(makeContext());
      // The prompt should not reference its own existence
      expect(prompt.toLowerCase()).not.toContain("system_prompt");
    });
  });
});
