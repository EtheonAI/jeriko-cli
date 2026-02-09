import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import {
  db,
  users,
  accounts,
  authSessions,
  verifications,
  organizations,
  members,
  invitations,
  apiKeys,
} from "@repo/database";
import crypto from "node:crypto";
import {
  sendEmail,
  VerificationEmail,
  PasswordResetEmail,
  InvitationEmail,
} from "@repo/email";

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

    async sendVerificationEmail(data: { user: { email?: string; name: string; [key: string]: unknown }; url: string; [key: string]: unknown }) {
      await sendEmail({
        to: data.user.email!,
        subject: "Verify your email address - Rubic",
        react: VerificationEmail({
          userName: data.user.name || undefined,
          verificationUrl: data.url,
        }),
      });
    },

    async sendResetPassword(data: { user: { email?: string; name: string; [key: string]: unknown }; url: string; [key: string]: unknown }) {
      await sendEmail({
        to: data.user.email!,
        subject: "Reset your password - Rubic",
        react: PasswordResetEmail({
          userName: data.user.name || undefined,
          resetUrl: data.url,
        }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail(data: { user: { email?: string; name: string; [key: string]: unknown }; url: string; [key: string]: unknown }) {
      await sendEmail({
        to: data.user.email!,
        subject: "Verify your email address - Rubic",
        react: VerificationEmail({
          userName: data.user.name || undefined,
          verificationUrl: data.url,
        }),
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

      async sendInvitationEmail(data) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const inviteUrl = `${baseUrl}/accept-invitation/${data.id}`;

        await sendEmail({
          to: data.email,
          subject: `You've been invited to join ${data.organization.name} - Rubic`,
          react: InvitationEmail({
            inviterName: data.inviter?.user?.name || data.email,
            organizationName: String(data.organization.name || ""),
            role: data.role,
            inviteUrl,
          }),
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
    window: 60,
    max: 10,
  },

  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3001",
  ].filter(Boolean),

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-generate a default API key for every new user
          try {
            const random = crypto.randomBytes(24).toString("base64url");
            const key = `rk_live_${random}`;
            const prefix = key.slice(0, 12) + "...";

            await db.insert(apiKeys).values({
              id: crypto.randomBytes(12).toString("base64url"),
              userId: user.id,
              key,
              keyPrefix: prefix,
              name: "Default",
            });
          } catch {
            // Non-fatal — user can create keys manually from Settings
          }
        },
      },
    },
  },
});

// Type exports
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
