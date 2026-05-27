import { z } from "zod";

export const flowSourceLocationSchema = z.object({
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const flowSourceSpanSchema = z.object({
  start: flowSourceLocationSchema,
  end: flowSourceLocationSchema,
});

export const flowSourceSchema = z.object({
  id: z.string().min(1),
  path: z.string().optional(),
  text: z.string(),
  languageVersion: z.string().default("0.1"),
});

export type FlowSourceLocation = z.infer<typeof flowSourceLocationSchema>;
export type FlowSourceSpan = z.infer<typeof flowSourceSpanSchema>;
export type FlowSource = z.infer<typeof flowSourceSchema>;

export function createFlowSource(
  text: string,
  options: {
    id?: string;
    path?: string;
    languageVersion?: string;
  } = {}
): FlowSource {
  return flowSourceSchema.parse({
    id: options.id ?? "inline.flow",
    path: options.path,
    text,
    languageVersion: options.languageVersion,
  });
}
