import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@repo/auth/server";

/**
 * Context creation for tRPC
 */
export const createTRPCContext = async (opts: {
  headers: Headers;
}) => {
  const session = await auth.api.getSession({
    headers: opts.headers,
  });

  return {
    session,
    user: session?.user ?? null,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Export reusable router and procedure helpers
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthenticated) procedure
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 */
export const protectedProcedure = t.procedure.use(({ ctx, next, path }) => {
  if (!ctx.session || !ctx.user) {
    console.error(`[tRPC] UNAUTHORIZED on ${path}:`, {
      hasSession: !!ctx.session,
      hasUser: !!ctx.user,
      session: ctx.session,
    });
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // Infers the `session` and `user` as non-nullable
      session: ctx.session,
      user: ctx.user,
    },
  });
});
