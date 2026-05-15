import { tool } from "ai";
import { z } from "zod";
import { sql } from "@/lib/db/connect";

type DbRow = {
  source_id: string;
  dataset_id: string;
  name: string;
  description: string | null;
  has_geometry: boolean;
  total: string;
};

export const searchCatalog = tool({
  description:
    "Full-text search over 2,500+ NYC Open Data datasets. Use this when the " +
    "user asks for something not in the curated category list. Returns dataset " +
    "metadata, use fetchDatasetDirect to inspect a specific dataset.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Full-text search query for NYC Open Data datasets"),
    onlyGeospatial: z
      .boolean()
      .default(true)
      .optional()
      .describe("Only return datasets with geometry"),
    limit: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .optional()
      .describe("Max results"),
  }),
  execute: async ({ query, onlyGeospatial = true, limit = 10 }) => {
    const rows = (await sql`
      SELECT
        d.source_id, d.dataset_id, d.name, d.description, d.has_geometry,
        count(*) OVER() AS total
      FROM datasets d
      WHERE
        (${onlyGeospatial}::boolean = false OR d.has_geometry = true)
        AND (
          ${query} = ''
          OR to_tsvector('english', coalesce(d.name, '') || ' ' || coalesce(d.description, ''))
             @@ websearch_to_tsquery('english', ${query})
        )
      ORDER BY
        CASE WHEN ${query} = '' THEN 0
             ELSE ts_rank(
               to_tsvector('english', coalesce(d.name, '') || ' ' || coalesce(d.description, '')),
               websearch_to_tsquery('english', ${query})
             )
        END DESC
      LIMIT ${limit}
    `) as DbRow[];

    return {
      total: rows[0] ? Number(rows[0].total) : 0,
      datasets: rows.map((r) => ({
        datasetId: r.dataset_id,
        name: r.name,
        description: r.description ?? "",
        hasGeometry: r.has_geometry,
      })),
    };
  },
});
