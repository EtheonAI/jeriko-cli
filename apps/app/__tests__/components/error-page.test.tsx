import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorPage from "@/app/error";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  AlertCircle: () => <svg data-testid="alert-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
}));

// Mock design system button
vi.mock("@repo/design-system/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe("ErrorPage", () => {
  const mockReset = vi.fn();
  const mockError = new Error("Test error") as Error & { digest?: string };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error message", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("renders descriptive help text", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(
      screen.getByText(/unexpected error occurred/i)
    ).toBeDefined();
  });

  it("renders Try again button", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.getByText("Try again")).toBeDefined();
  });

  it("calls reset when Try again is clicked", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("displays error digest when available", () => {
    const errorWithDigest = new Error("Test") as Error & { digest: string };
    errorWithDigest.digest = "abc123";

    render(<ErrorPage error={errorWithDigest} reset={mockReset} />);
    expect(screen.getByText(/abc123/)).toBeDefined();
  });

  it("does not display digest when not available", () => {
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(screen.queryByText(/Error ID/)).toBeNull();
  });

  it("reports error to Sentry on mount", async () => {
    const { captureException } = await import("@sentry/nextjs");
    render(<ErrorPage error={mockError} reset={mockReset} />);
    expect(captureException).toHaveBeenCalledWith(mockError);
  });
});
