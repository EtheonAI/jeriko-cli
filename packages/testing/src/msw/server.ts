import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server for Node.js test environments (Vitest, Jest).
 *
 * Usage in vitest setup:
 *   import { server } from "@repo/testing/msw";
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
export const server = setupServer(...handlers);
