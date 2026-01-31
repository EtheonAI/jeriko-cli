import { Resend } from "resend";
import { render } from "@react-email/components";
import { keys } from "./keys";

// Initialize Resend client
const resend = new Resend(keys().RESEND_TOKEN);

// Email configuration
const FROM_EMAIL = keys().RESEND_FROM;

// Types
export interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Send email function
export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const html = await render(react);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { success: false, error: error.message };
    }

    console.log("[Email] Sent successfully:", data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Error:", message);
    return { success: false, error: message };
  }
}

// Export Resend client for advanced usage
export { resend };

// Export templates
export * from "./templates";
