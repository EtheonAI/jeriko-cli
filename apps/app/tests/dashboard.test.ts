import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import DashboardPage from "../app/(authenticated)/page";

describe("reset dashboard shell", () => {
  it("renders the dashboard-only rebuild surface", () => {
    const html = renderToStaticMarkup(createElement(DashboardPage));

    expect(html).toContain("Dashboard");
    expect(html).toContain("No workflows yet");
    expect(html).toContain("Workflows");
    expect(html).toContain("Runs");
    expect(html).toContain("Approvals");
  });

  it("renders the dashboard shell at the authenticated root", () => {
    const html = renderToStaticMarkup(createElement(DashboardPage));

    expect(html).toContain("Dashboard");
    expect(html).not.toContain("NEXT_REDIRECT");
  });
});
