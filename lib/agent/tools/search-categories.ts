import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories/registry";

export const searchCategories = tool({
  description:
    "Search the curated map layer catalog by keyword, theme, or geometry type. " +
    "Returns matching category metadata, use addMapLayer to actually show one on the map.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Search term: name, keyword, or description fragment"),
    theme: z
      .enum([
        "transit",
        "nature",
        "buildings",
        "civic",
        "safety",
        "health",
        "education",
        "environment",
        "commerce",
      ])
      .optional()
      .describe("Filter to a specific theme"),
    kind: z
      .enum(["points", "lines", "polygons"])
      .optional()
      .describe("Filter by geometry type"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .default(5)
      .optional()
      .describe("Max results to return"),
  }),
  execute: async ({ query, theme, kind, limit = 5 }) => {
    const q = query.toLowerCase();

    const matches = CATEGORIES.filter((cat) => {
      if (theme && cat.theme !== theme) return false;
      if (kind && cat.kind !== kind) return false;
      return (
        cat.name.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        cat.id.includes(q)
      );
    });

    return matches.slice(0, limit).map((cat) => ({
      id: cat.id,
      name: cat.name,
      theme: cat.theme,
      kind: cat.kind,
      description: cat.description,
    }));
  },
});
