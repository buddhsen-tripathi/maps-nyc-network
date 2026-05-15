import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES_BY_ID } from "@/lib/categories/registry";
import {
  fetchDataset,
  filterByKind,
  mergeCollections,
} from "@/lib/categories/fetchers";

export const summarizeFeatures = tool({
  description:
    "Analyze a curated map layer: count features, group by a property, or " +
    "filter to a bounding box. Use for analytical queries like 'How many trees " +
    "are in Brooklyn?' or 'Compare parks by borough'.",
  inputSchema: z.object({
    categoryId: z.string().describe("Category to analyze"),
    groupBy: z
      .string()
      .optional()
      .describe("Property key to group and count features by"),
    countOnly: z
      .boolean()
      .default(false)
      .optional()
      .describe("If true, only return the total count"),
    boundingBox: z
      .object({
        swLng: z.number().describe("Southwest corner longitude"),
        swLat: z.number().describe("Southwest corner latitude"),
        neLng: z.number().describe("Northeast corner longitude"),
        neLat: z.number().describe("Northeast corner latitude"),
      })
      .optional()
      .describe("Only count features within this bounding box"),
  }),
  execute: async ({ categoryId, groupBy, countOnly = false, boundingBox }) => {
    const cat = CATEGORIES_BY_ID.get(categoryId);
    if (!cat) {
      return { categoryId, total: 0, error: `Unknown category: ${categoryId}` };
    }

    const collections = await Promise.all(
      cat.datasets.map((ds) => fetchDataset(ds, {})),
    );
    const merged = mergeCollections(collections);
    let features = filterByKind(merged, cat.kind).features;

    // Bounding box filter
    if (boundingBox) {
      const { swLng, swLat, neLng, neLat } = boundingBox;
      features = features.filter((f) => {
        if (!f.geometry) return false;
        const coords = getRepresentativeCoord(f.geometry);
        if (!coords) return false;
        const [lng, lat] = coords;
        return lng >= swLng && lng <= neLng && lat >= swLat && lat <= neLat;
      });
    }

    const total = features.length;

    if (countOnly) {
      return { categoryId, total };
    }

    // Group by property
    let groups: Record<string, number> | undefined;
    if (groupBy) {
      groups = {};
      for (const f of features) {
        const val = String(f.properties?.[groupBy] ?? "unknown");
        groups[val] = (groups[val] ?? 0) + 1;
      }
      // Keep only top 15 groups by count
      const sorted = Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
      groups = Object.fromEntries(sorted);
    }

    // Sample property keys
    const propKeys = new Set<string>();
    for (const f of features.slice(0, 5)) {
      if (f.properties) {
        for (const k of Object.keys(f.properties)) propKeys.add(k);
      }
    }

    return {
      categoryId,
      total,
      groups,
      sampleProperties: Array.from(propKeys).slice(0, 15),
    };
  },
});

/**
 * Extract a single representative [lng, lat] from any geometry type.
 */
function getRepresentativeCoord(
  geometry: GeoJSON.Geometry,
): [number, number] | null {
  switch (geometry.type) {
    case "Point":
      return geometry.coordinates as [number, number];
    case "MultiPoint":
    case "LineString":
      return geometry.coordinates[0] as [number, number];
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates[0]?.[0] as [number, number] | null;
    case "MultiPolygon":
      return geometry.coordinates[0]?.[0]?.[0] as [number, number] | null;
    default:
      return null;
  }
}
