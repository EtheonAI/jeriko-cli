import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RootLoading from "@/app/loading";
import AuthenticatedLoading from "@/app/(authenticated)/loading";

// Mock Skeleton
vi.mock("@repo/design-system/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe("RootLoading", () => {
  it("renders skeleton elements", () => {
    render(<RootLoading />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("is centered on screen", () => {
    const { container } = render(<RootLoading />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("min-h-screen");
    expect(wrapper?.className).toContain("items-center");
    expect(wrapper?.className).toContain("justify-center");
  });
});

describe("AuthenticatedLoading", () => {
  it("renders multiple skeleton elements", () => {
    render(<AuthenticatedLoading />);
    const skeletons = screen.getAllByTestId("skeleton");
    // Header + content skeletons
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("has proper layout structure", () => {
    const { container } = render(<AuthenticatedLoading />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("flex");
    expect(wrapper?.className).toContain("flex-col");
  });
});
