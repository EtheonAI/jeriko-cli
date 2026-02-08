/**
 * Shared Zod schemas for Manus-aligned tool parameters.
 */
import { z } from "zod";

// Common parameter schemas
export const filePathSchema = z.string().describe("Absolute path of the file");
export const shellIdSchema = z.string().describe("Unique identifier of the target shell session");
export const urlSchema = z.string().describe("Complete URL. Must include protocol prefix.");
export const sudoSchema = z.boolean().optional().describe("Whether to use sudo privileges");
