import { describe, it, expect } from "vitest";
import {
  ShowPlanInputSchema,
  FileReadInputSchema,
  FileWriteInputSchema,
  ShellExecInputSchema,
  BrowserActionInputSchema,
  WebSearchInputSchema,
} from "../src/schemas/tools";

describe("Tool Contract - Planning Tools", () => {
  it("valid show_plan input passes validation", () => {
    const input = {
      title: "Implement feature X",
      todos: [
        { id: "1", label: "Read documentation", status: "completed" as const },
        { id: "2", label: "Write code", status: "in_progress" as const },
        { id: "3", label: "Add tests", status: "pending" as const },
      ],
    };

    const result = ShowPlanInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.todos).toHaveLength(3);
      expect(result.data.title).toBe("Implement feature X");
    }
  });

  it("empty title fails validation", () => {
    const input = {
      title: "",
      todos: [{ id: "1", label: "Task", status: "pending" as const }],
    };

    const result = ShowPlanInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("invalid status enum fails validation", () => {
    const input = {
      title: "Plan",
      todos: [{ id: "1", label: "Task", status: "invalid_status" }],
    };

    const result = ShowPlanInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Tool Contract - File System Tools", () => {
  it("valid file_read input passes validation", () => {
    const input = { path: "/home/user/file.txt" };

    const result = FileReadInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe("/home/user/file.txt");
    }
  });

  it("empty path fails validation", () => {
    const input = { path: "" };

    const result = FileReadInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("valid file_write input passes validation", () => {
    const input = {
      path: "/home/user/new.txt",
      content: "Hello, world!",
    };

    const result = FileWriteInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("Hello, world!");
    }
  });

  it("missing content in file_write fails validation", () => {
    const input = { path: "/home/user/new.txt" };

    const result = FileWriteInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Tool Contract - Shell Tools", () => {
  it("valid shell_exec input passes validation", () => {
    const input = {
      session_id: "shell_001",
      command: "ls -la",
      timeout: 30,
    };

    const result = ShellExecInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.command).toBe("ls -la");
      expect(result.data.timeout).toBe(30);
    }
  });

  it("shell_exec without optional timeout is valid", () => {
    const input = {
      session_id: "shell_001",
      command: 'echo "hello"',
    };

    const result = ShellExecInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("negative timeout fails validation", () => {
    const input = {
      session_id: "shell_001",
      command: "ls",
      timeout: -1,
    };

    const result = ShellExecInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Tool Contract - Browser Tools", () => {
  it("valid browser navigate action passes validation", () => {
    const input = {
      action: "navigate" as const,
      url: "https://example.com",
    };

    const result = BrowserActionInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe("navigate");
      expect(result.data.url).toBe("https://example.com");
    }
  });

  it("valid browser click action passes validation", () => {
    const input = {
      action: "click" as const,
      selector: "#submit-button",
    };

    const result = BrowserActionInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("invalid action enum fails validation", () => {
    const input = {
      action: "invalid_action",
    };

    const result = BrowserActionInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Tool Contract - Search Tools", () => {
  it("valid web_search input passes validation", () => {
    const input = {
      query: "TypeScript best practices",
      num_results: 5,
    };

    const result = WebSearchInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe("TypeScript best practices");
      expect(result.data.num_results).toBe(5);
    }
  });

  it("web_search defaults num_results to 10", () => {
    const input = {
      query: "search query",
    };

    const result = WebSearchInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.num_results).toBe(10);
    }
  });

  it("num_results exceeding max fails validation", () => {
    const input = {
      query: "search",
      num_results: 100,
    };

    const result = WebSearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("empty query fails validation", () => {
    const input = {
      query: "",
    };

    const result = WebSearchInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
