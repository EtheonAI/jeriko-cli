import { render } from "react-email";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordResetEmail } from "../templates/password-reset";
import { VerificationEmail } from "../templates/verification";

vi.mock("server-only", () => ({}));

const resendMock = vi.hoisted(() => ({
  send: vi.fn(),
  tokens: [] as string[],
}));

vi.mock("resend", () => ({
  Resend: class Resend {
    emails = {
      send: resendMock.send,
    };

    constructor(token: string) {
      resendMock.tokens.push(token);
    }
  },
}));

describe("@repo/email templates", () => {
  it("renders password reset links", async () => {
    const resetUrl = "https://app.example.com/reset-password?token=abc123";
    const html = await render(
      PasswordResetEmail({
        resetUrl,
        userName: "Ada",
      })
    );

    expect(html).toContain("Reset your password");
    expect(html).toContain(resetUrl);
  });

  it("renders verification links", async () => {
    const verificationUrl = "https://app.example.com/verify-email?token=abc123";
    const html = await render(
      VerificationEmail({
        userName: "Ada",
        verificationUrl,
      })
    );

    expect(html).toContain("Verify your email address");
    expect(html).toContain(verificationUrl);
  });
});

describe("@repo/email sendEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    resendMock.send.mockReset();
    resendMock.tokens.length = 0;
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM = "Jeriko <noreply@example.com>";
    delete process.env.RESEND_TOKEN;
  });

  it("sends rendered React Email HTML through Resend", async () => {
    resendMock.send.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    const { sendEmail } = await import("../index");
    const result = await sendEmail({
      react: PasswordResetEmail({
        resetUrl: "https://app.example.com/reset-password?token=abc123",
        userName: "Ada",
      }),
      subject: "Reset your password - Jeriko",
      to: "ada@example.com",
    });

    expect(result).toEqual({ success: true, id: "email_123" });
    expect(resendMock.tokens).toEqual(["re_test"]);
    expect(resendMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Jeriko <noreply@example.com>",
        subject: "Reset your password - Jeriko",
        to: "ada@example.com",
        html: expect.stringContaining("https://app.example.com/reset-password"),
      })
    );
  });

  it("returns structured errors from Resend", async () => {
    resendMock.send.mockResolvedValue({
      data: null,
      error: { message: "domain is not verified" },
    });

    const { sendEmail } = await import("../index");
    const result = await sendEmail({
      react: VerificationEmail({
        verificationUrl: "https://app.example.com/verify-email?token=abc123",
      }),
      subject: "Verify your email address - Jeriko",
      to: "ada@example.com",
    });

    expect(result).toEqual({
      success: false,
      error: "domain is not verified",
    });
  });

  it("returns a structured error when Resend credentials are missing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_TOKEN;

    const { sendEmail } = await import("../index");
    const result = await sendEmail({
      react: VerificationEmail({
        verificationUrl: "https://app.example.com/verify-email?token=abc123",
      }),
      subject: "Verify your email address - Jeriko",
      to: "ada@example.com",
    });

    expect(result).toEqual({
      success: false,
      error: "RESEND_TOKEN or RESEND_API_KEY is required to send email.",
    });
  });
});
