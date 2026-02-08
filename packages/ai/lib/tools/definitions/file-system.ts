/**
 * File system tools — file_read, file_write, file_str_replace, file_find_in_content, file_find_by_name
 */
import { z } from "zod";
import { filePathSchema, sudoSchema } from "./schemas";

export const fileSystemTools = {
  file_read: {
    description:
      "Read file content. Use for checking file contents, analyzing logs, or reading configuration files.",
    parameters: z.object({
      file: filePathSchema.describe("Absolute path of the file to read"),
      start_line: z.number().int().optional().describe("Starting line to read from, 0-based"),
      end_line: z.number().int().optional().describe("Ending line number (exclusive)"),
      sudo: sudoSchema,
    }),
  },
  file_write: {
    description:
      "Overwrite or append content to a file. Use for creating new files, appending content, or modifying existing files.",
    parameters: z.object({
      file: filePathSchema.describe("Absolute path of the file to write to"),
      content: z.string().describe("Text content to write"),
      append: z.boolean().optional().describe("Whether to use append mode"),
      leading_newline: z.boolean().optional().describe("Whether to add a leading newline"),
      trailing_newline: z.boolean().optional().describe("Whether to add a trailing newline"),
      sudo: sudoSchema,
    }),
  },
  file_str_replace: {
    description:
      "Replace specified string in a file. Use for updating specific content in files or fixing errors in code.",
    parameters: z.object({
      file: filePathSchema.describe("Absolute path of the file to perform replacement on"),
      old_str: z.string().describe("Original string to be replaced"),
      new_str: z.string().describe("New string to replace with"),
      sudo: sudoSchema,
    }),
  },
  file_find_in_content: {
    description:
      "Search for matching text within file content. Use for finding specific content or patterns in files.",
    parameters: z.object({
      file: filePathSchema.describe("Absolute path of the file to search within"),
      regex: z.string().describe("Regular expression pattern to match"),
      sudo: sudoSchema,
    }),
  },
  file_find_by_name: {
    description:
      "Find files by name pattern in specified directory. Use for locating files with specific naming patterns.",
    parameters: z.object({
      path: z.string().describe("Absolute path of directory to search"),
      glob: z.string().describe("Filename pattern using glob syntax wildcards"),
    }),
  },
} as const;
