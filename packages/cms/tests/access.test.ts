import { describe, expect, it, vi } from "vitest";
import { firstCmsUserOrAdmin, hasCmsRole, publishedOrCmsEditor, publishedWhere } from "../access";

describe("@repo/cms access helpers", () => {
  it("checks CMS roles from role or roles fields", () => {
    expect(hasCmsRole({ role: "admin" }, ["admin"])).toBe(true);
    expect(hasCmsRole({ roles: ["editor"] }, ["editor"])).toBe(true);
    expect(hasCmsRole({ role: "viewer" }, ["admin"])).toBe(false);
    expect(hasCmsRole(null, ["admin"])).toBe(false);
  });

  it("lets CMS editors read drafts and limits public reads to published docs", async () => {
    expect(await publishedOrCmsEditor({ req: { user: { role: "editor" } } } as never)).toBe(true);
    expect(await publishedOrCmsEditor({ req: { user: null } } as never)).toEqual(publishedWhere);
  });

  it("allows first CMS user bootstrap before admins exist", async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 0 });

    await expect(
      firstCmsUserOrAdmin({
        req: {
          payload: { count },
          user: null,
        },
      } as never)
    ).resolves.toBe(true);
    expect(count).toHaveBeenCalledWith({
      collection: "cms-users",
      overrideAccess: true,
    });
  });
});
