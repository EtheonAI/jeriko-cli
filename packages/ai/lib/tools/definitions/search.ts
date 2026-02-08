/**
 * Search tools — info_search_web
 */
import { z } from "zod";

export const searchTools = {
  info_search_web: {
    description:
      "Search web pages using search engine. Use for obtaining latest information or finding references.",
    parameters: z.object({
      query: z.string().describe("Search query in Google search style, using 3-5 keywords"),
      date_range: z
        .enum(["all", "past_hour", "past_day", "past_week", "past_month", "past_year"])
        .optional()
        .describe("Time range filter for search results"),
    }),
  },
} as const;
