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

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

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
    autoSignIn: false, // Don't auto sign in - require email verification first
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    sendVerificationEmail: async ({
      user,
      url,
      token,
    }: {
      user: { email: string; name?: string | null };
      url: string;
      token: string;
    }) => {
      // TODO: Integrate with email service (Resend/Knock)
      // For now, log the verification details
      console.log(`Verification email for ${user.email}:`);
      console.log(`URL: ${url}`);
      console.log(`Token/Code: ${token}`);
    },
    sendResetPassword: async ({
      user,
      url,
      token,
    }: {
      user: { email: string; name?: string | null };
      url: string;
      token: string;
    }) => {
      // TODO: Integrate with email service (Resend/Knock)
      console.log(`Password reset for ${user.email}:`);
      console.log(`URL: ${url}`);
      console.log(`Token: ${token}`);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      // TODO: Send verification code via Resend/Knock
      console.log(`Email verification for ${user.email}:`);
      console.log(`Verification code: ${token}`);
      console.log(`Verification URL: ${url}`);
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      enabled: !!process.env.GITHUB_ID,
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      sendInvitationEmail: async ({ email, inviter, organization, role }) => {
        // TODO: Send invitation via Knock notifications
        console.log(`Organization invitation:`);
        console.log(`To: ${email}`);
        console.log(`Organization: ${organization.name}`);
        console.log(`Invited by: ${inviter.user.name || inviter.user.email}`);
        console.log(`Role: ${role}`);
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
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

export type Auth = typeof auth;
