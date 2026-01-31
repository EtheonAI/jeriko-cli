// Server-side auth (use in API routes and server components)
export { auth, type Auth } from "./server";

// Client-side auth (use in client components)
export {
  authClient,
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  organization,
  type Session,
  type User,
  type Organization,
  type Member,
} from "./client";

// Validation schemas
export { userAuthSchema } from "./validations/auth";
