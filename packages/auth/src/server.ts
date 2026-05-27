import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins/organization";
import { after } from "next/server";
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
import { sendEmail, VerificationEmail, PasswordResetEmail, InvitationEmail } from "@repo/email";
import { keys } from "../keys";

const authEnv = keys();
const authBaseUrl = authEnv.BETTER_AUTH_URL;
const hasGoogleProvider = !!(authEnv.GOOGLE_CLIENT_ID && authEnv.GOOGLE_CLIENT_SECRET);
const hasGitHubProvider = !!(authEnv.GITHUB_CLIENT_ID && authEnv.GITHUB_CLIENT_SECRET);

function queueAuthEmail(label: string, send: () => Promise<unknown>) {
  after(async () => {
    try {
      await send();
    } catch (error) {
      console.error(`Failed to send ${label}:`, error);
    }
  });
}

// Better Auth configuration
export const auth = betterAuth({
  appName: "Jeriko",
  baseURL: authBaseUrl,
  secret: authEnv.BETTER_AUTH_SECRET,

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
    revokeSessionsOnPasswordReset: true,

    async sendResetPassword(data: {
      user: { email?: string; name: string; [key: string]: unknown };
      url: string;
      [key: string]: unknown;
    }) {
      queueAuthEmail("password reset email", () =>
        sendEmail({
          to: data.user.email!,
          subject: "Reset your password - Jeriko",
          react: PasswordResetEmail({
            userName: data.user.name || undefined,
            resetUrl: data.url,
          }),
        })
      );
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail(data: {
      user: { email?: string; name: string; [key: string]: unknown };
      url: string;
      [key: string]: unknown;
    }) {
      queueAuthEmail("verification email", () =>
        sendEmail({
          to: data.user.email!,
          subject: "Verify your email address - Jeriko",
          react: VerificationEmail({
            userName: data.user.name || undefined,
            verificationUrl: data.url,
          }),
        })
      );
    },
  },

  socialProviders: {
    google: {
      clientId: authEnv.GOOGLE_CLIENT_ID ?? "",
      clientSecret: authEnv.GOOGLE_CLIENT_SECRET ?? "",
      enabled: hasGoogleProvider,
    },
    github: {
      clientId: authEnv.GITHUB_CLIENT_ID ?? "",
      clientSecret: authEnv.GITHUB_CLIENT_SECRET ?? "",
      enabled: hasGitHubProvider,
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,

      async sendInvitationEmail(data) {
        const inviteUrl = `${authBaseUrl}/accept-invitation/${data.id}`;

        queueAuthEmail("organization invitation email", () =>
          sendEmail({
            to: data.email,
            subject: `You've been invited to join ${data.organization.name} - Jeriko`,
            react: InvitationEmail({
              inviterName: data.inviter?.user?.name || data.email,
              organizationName: String(data.organization.name || ""),
              role: data.role,
              inviteUrl,
            }),
          })
        );
      },
    }),
    nextCookies(),
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
    window: 60,
    max: 10,
  },

  trustedOrigins: [authBaseUrl],
});

// Type exports
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
