import { describe, expect, it, vi } from "vitest";
import { cmsCollections } from "../collections";
import { createPayloadConfig } from "../config";
import { cmsGlobals } from "../globals";

vi.mock("server-only", () => ({}));

describe("@repo/cms Payload config", () => {
  it("defines initial Payload collections and globals", () => {
    expect(cmsCollections.map((collection) => collection.slug)).toEqual([
      "cms-users",
      "media",
      "pages",
      "posts",
      "legal-pages",
    ]);
    expect(cmsGlobals.map((global) => global.slug)).toEqual(["site-settings"]);
  });

  it("builds a package-owned Payload config", async () => {
    const config = await createPayloadConfig({
      databaseUrl: "postgres://user:pass@localhost:5432/cms",
      generatedGraphqlSchemaPath: "/tmp/payload-schema.graphql",
      generatedTypesPath: "/tmp/payload-types.ts",
      migrationDir: "/tmp/payload-migrations",
      secret: "x".repeat(32),
      serverURL: "https://example.com",
    });

    expect(config.admin.user).toBe("cms-users");
    expect(config.collections.map((collection) => collection.slug)).toContain("posts");
    expect(config.globals.map((global) => global.slug)).toContain("site-settings");
    expect(config.secret).toBe("x".repeat(32));
    expect(config.serverURL).toBe("https://example.com");
  });
});
