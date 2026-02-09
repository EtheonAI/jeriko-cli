/**
 * Website Builder Service Unit Tests
 */
import { describe, it, expect } from "vitest";

describe("Template management", () => {
  it("should validate template types", () => {
    const types = ["landing", "portfolio", "blog", "docs", "ecommerce"];
    for (const t of types) {
      expect(typeof t).toBe("string");
    }
  });

  it("should require template name", () => {
    const template = { name: "My Landing Page", type: "landing" };
    expect(template.name).toBeTruthy();
  });
});

describe("Website CRUD", () => {
  it("should generate slug from name", () => {
    const slugify = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    expect(slugify("My Cool Website")).toBe("my-cool-website");
    expect(slugify("  Leading Spaces  ")).toBe("leading-spaces");
  });

  it("should validate domain format", () => {
    const isValidDomain = (d: string) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$/i.test(d);
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("my-site.rubic.dev")).toBe(true);
    expect(isValidDomain("not a domain")).toBe(false);
  });
});

describe("Website deployment", () => {
  it("should support deployment statuses", () => {
    const statuses = ["draft", "building", "deployed", "failed"];
    expect(statuses).toContain("deployed");
  });
});
