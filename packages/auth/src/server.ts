import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
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
        react: VerificationEmail({
          userName: user.name || undefined,
          verificationUrl: url,
        }),
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
        react: PasswordResetEmail({
          userName: user.name || undefined,
          resetUrl: url,
        }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
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
        react: VerificationEmail({
          userName: user.name || undefined,
          verificationUrl: url,
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

      async sendInvitationEmail({
        email,
        inviter,
        organization: org,
        role,
        id,
      }: {
        email: string;
        inviter: { user: { name?: string | null; email: string } };
        organization: { name: string };
        role: string;
        id: string;
      }) {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const inviteUrl = `${baseUrl}/accept-invitation/${id}`;

        await sendEmail({
          to: email,
          subject: `You've been invited to join ${org.name} - Rubic`,
          react: InvitationEmail({
            inviterName: inviter.user.name || inviter.user.email,
            organizationName: org.name,
            role,
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
});

// Type exports
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
