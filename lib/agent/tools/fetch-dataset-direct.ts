import { tool } from "ai";
import { z } from "zod";
import { fetchDataset } from "@/lib/categories/fetchers";
import type { SocrataDataset } from "@/lib/categories/types";

export const fetchDatasetDirect = tool({
  description:
    "Fetch a raw NYC Open Data (Socrata) dataset by its 4x4 ID to inspect its " +
    "contents. Returns a summary with feature count, geometry type, and sample " +
    "property names, not the full GeoJSON. Use after searchCatalog to explore " +
    "a dataset before deciding whether to surface it.",
  inputSchema: z.object({
    datasetId: z
      .string()
      .describe("Socrata 4x4 dataset ID (e.g. 'h9gi-nx95')"),
    domain: z
      .string()
      .default("data.cityofnewyork.us")
      .optional()
      .describe("Socrata domain"),
    where: z
      .string()
      .optional()
      .describe("SoQL $where clause for filtering (e.g. \"status='Open'\")"),
    limit: z
      .number()
      .min(1)
      .max(5000)
      .default(1000)
      .optional()
      .describe("Max features to fetch"),
  }),
  execute: async ({
    datasetId,
    domain = "data.cityofnewyork.us",
    where,
    limit = 1000,
  }) => {
    const ds: SocrataDataset = {
      protocol: "socrata",
      domain,
      id: datasetId,
      limit,
      where,
    };

    try {
      const fc = await fetchDataset(ds, {});
      const features = fc.features;
      const geometryType =
        features.length > 0 && features[0].geometry
          ? features[0].geometry.type
          : null;

      const propKeys = new Set<string>();
      for (const f of features.slice(0, 10)) {
        if (f.properties) {
          for (const k of Object.keys(f.properties)) propKeys.add(k);
        }
      }

      return {
        datasetId,
        featureCount: features.length,
        sampleProperties: Array.from(propKeys).slice(0, 15),
        geometryType,
      };
    } catch (err) {
      return {
        datasetId,
        featureCount: 0,
        sampleProperties: [],
        geometryType: null,
        error: `Failed to fetch dataset: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
