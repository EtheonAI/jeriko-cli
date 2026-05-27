import { describe, expect, it } from "vitest";
import en from "../dictionaries/en.json";
import es from "../dictionaries/es.json";
import { getDictionary, hasLocale } from "../index";
import { routing } from "../routing";

describe("@repo/internationalization", () => {
  it("loads a supported locale dictionary", async () => {
    await expect(getDictionary("es")).resolves.toBe(es);
  });

  it("falls back to the default dictionary for unsupported locales", async () => {
    await expect(getDictionary("missing")).resolves.toBe(en);
  });

  it("checks locales against the package routing config", () => {
    expect(hasLocale(routing.locales, "en")).toBe(true);
    expect(hasLocale(routing.locales, "missing")).toBe(false);
    expect(hasLocale(routing.locales, undefined)).toBe(false);
  });
});
