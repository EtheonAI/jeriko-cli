import NextAuth from "next-auth";
import { database as db } from "@repo/database";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { userAuthSchema } from "./lib/validations/auth";
import { InvalidPasswordError, InvalidCredentialsError } from "./lib/validations/auth-errors";

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // Validate with Zod
          const { email, password } = await userAuthSchema.parseAsync(credentials);

          // Find user
          const user = await db.user.findUnique({
            where: { email: email.toLowerCase() },
          });

          // User doesn't exist - create new user
          if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = await db.user.create({
              data: {
                email: email.toLowerCase(),
                password: hashedPassword,
              },
            });

            console.log("✅ User created:", newUser.id);

            return {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              image: newUser.image,
            };
          }

          // User exists but no password (OAuth user trying to use credentials)
          if (!user.password) {
            console.log("❌ OAuth user trying credentials login");
            throw new InvalidCredentialsError("This account uses social login");
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.password);

          if (!isValid) {
            console.log("❌ Invalid password for:", email);
            throw new InvalidPasswordError("Invalid email or password");
          }

          console.log("✅ User authenticated:", user.id);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          // Re-throw custom errors
          if (error instanceof InvalidPasswordError || error instanceof InvalidCredentialsError) {
            throw error;
          }

          // Handle other errors
          console.error("❌ Authorize error:", error);
          throw new InvalidCredentialsError("Authentication failed");
        }
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.name = token.name;
        session.user.email = token.email!;
        session.user.image = token.picture;
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id;
      }

      // Handle GitHub OAuth
      if (account?.provider === "github" && profile?.email) {
        try {
          let dbUser = await db.user.findUnique({
            where: { email: profile.email as string },
          });

          if (!dbUser) {
            dbUser = await db.user.create({
              data: {
                email: profile.email as string,
                name: (profile.name as string) || null,
                image: ((profile as any).avatar_url as string) || null,
              },
            });
            console.log("✅ GitHub user created:", dbUser.id);
          }

          token.sub = dbUser.id;
        } catch (error) {
          console.error("❌ GitHub user error:", error);
        }
      }

      return token;
    },
  },
});

export { default as authConfig } from "./auth.config";
export { default as NextAuth } from "next-auth";