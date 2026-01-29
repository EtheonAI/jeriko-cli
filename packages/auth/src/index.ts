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
  type Session,
  type User,
} from "./client";

// Validation schemas
export { userAuthSchema } from "./validations/auth";
