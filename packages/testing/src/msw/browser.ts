import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * MSW worker for browser environments (Storybook, dev mode).
 *
 * Usage:
 *   import { worker } from "@repo/testing/msw/browser";
 *   worker.start();
 */
export const worker = setupWorker(...handlers);
