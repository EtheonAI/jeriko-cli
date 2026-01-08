import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NeonAdapter from "@auth/neon-adapter"

import { database as db } from "@repo/database";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";


export const { auth, handlers, signIn, signOut } = NextAuth({
  // adapter: NeonAdapter(pool),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHub,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Authorize called with:", credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log("Missing email or password");
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          let user = await db.user.findUnique({
            where: { email },
          });

          console.log("User found:", !!user);

          if (!user) {
            // Create new user
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await db.user.create({
              data: {
                email,
                password: hashedPassword,
              },
            });
            console.log("User created:", user.id);
          } else {
            // Verify password
            if (!user.password) {
              console.log("User has no password (OAuth user)");
              return null;
            }

            const isValid = await bcrypt.compare(password, user.password);
            console.log("Password valid:", isValid);

            if (!isValid) {
              return null;
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
});

export { default as authConfig } from "./auth.config";
export { default as NextAuth } from "next-auth";