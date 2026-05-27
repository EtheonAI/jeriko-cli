import "server-only";

import { Resend } from "resend";
import { render } from "react-email";
import { keys } from "./keys";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const env = keys();
    if (!env.RESEND_TOKEN) {
      throw new Error("RESEND_TOKEN or RESEND_API_KEY is required to send email.");
    }

    resendClient = new Resend(env.RESEND_TOKEN);
  }

  return resendClient;
}

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
    const env = keys();

    const { data, error } = await getResendClient().emails.send({
      from: env.RESEND_FROM,
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

// Export a lazy Resend facade for advanced usage without constructing the
// provider at module import time.
export const resend: Pick<Resend, "emails"> = {
  emails: {
    send: (...args: Parameters<Resend["emails"]["send"]>) => getResendClient().emails.send(...args),
  } as Resend["emails"],
};

// Export templates
export * from "./templates";
