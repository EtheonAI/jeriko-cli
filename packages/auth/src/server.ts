import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { Resend } from "resend";
import {
  db,
  users,
  accounts,
  authSessions,
  verifications,
  organizations,
  members,
  invitations,
} from "@repo/database";

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "Rubic <noreply@etheon.ai>";

// Email sending helper
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw error;
    }

    console.log("Email sent successfully:", data?.id);
    return data;
  } catch (err) {
    console.error("Email sending failed:", err);
    throw err;
  }
}

// Email templates
const emailTemplates = {
  verification: (userName: string, verificationUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f9fafb;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="color: #111827; font-size: 24px; margin-bottom: 24px;">Verify your email address</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Hi ${userName || "there"},
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Thanks for signing up for Rubic. Please verify your email address by clicking the button below.
        </p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Verify Email
        </a>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
          This link will expire in 10 minutes. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `,

  passwordReset: (userName: string, resetUrl: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f9fafb;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="color: #111827; font-size: 24px; margin-bottom: 24px;">Reset your password</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Hi ${userName || "there"},
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your password. Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Reset Password
        </a>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `,

  invitation: (
    inviterName: string,
    organizationName: string,
    role: string,
    inviteUrl: string
  ) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f9fafb;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h1 style="color: #111827; font-size: 24px; margin-bottom: 24px;">You've been invited to join ${organizationName}</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          ${inviterName} has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.
        </p>
        <a href="${inviteUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Accept Invitation
        </a>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
          This invitation will expire in 7 days. If you don't want to join, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `,
};

// Better Auth configuration
export const auth = betterAuth({
  appName: "Rubic",
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      account: accounts,
      session: authSessions,
      verification: verifications,
      organization: organizations,
      member: members,
      invitation: invitations,
    },
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: true,

    async sendVerificationEmail({
      user,
      url,
    }: {
      user: { email: string; name?: string | null };
      url: string;
    }) {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address - Rubic",
        html: emailTemplates.verification(user.name || "", url),
      });
    },

    async sendResetPassword({
      user,
      url,
    }: {
      user: { email: string; name?: string | null };
      url: string;
    }) {
      await sendEmail({
        to: user.email,
        subject: "Reset your password - Rubic",
        html: emailTemplates.passwordReset(user.name || "", url),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address - Rubic",
        html: emailTemplates.verification(user.name || "", url),
      });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ),
    },
    github: {
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      enabled: !!(process.env.GITHUB_ID && process.env.GITHUB_SECRET),
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,

      async sendInvitationEmail({ email, inviter, organization, role, id }) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const inviteUrl = `${baseUrl}/accept-invitation/${id}`;

        await sendEmail({
          to: email,
          subject: `You've been invited to join ${organization.name} - Rubic`,
          html: emailTemplates.invitation(
            inviter.user.name || inviter.user.email,
            organization.name,
            role,
            inviteUrl
          ),
        });
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },

  rateLimit: {
    window: 60, // 1 minute
    max: 10, // 10 requests per minute
  },

  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3001",
  ].filter(Boolean),
});

// Type exports
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
