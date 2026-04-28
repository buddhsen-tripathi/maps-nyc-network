import { sql } from "../lib/db";

/**
 * Catalog discovery helper. Searches the synced datasets table for
 * candidate categories by keyword and prints top hits. Used while
 * curating lib/categories/registry.ts. Not part of the runtime.
 */

const QUERIES: { theme: string; queries: string[] }[] = [
  {
    theme: "transit",
    queries: [
      "ferry",
      "ferry terminal",
      "speed camera",
      "red light camera",
      "parking meter",
      "truck route",
      "ev charging",
      "bike rack",
      "bike share",
      "metro transit",
      "subway",
      "bus route",
    ],
  },
  {
    theme: "nature",
    queries: [
      "beach",
      "pool",
      "community garden",
      "wetland",
      "bird",
      "greenway",
      "forever wild",
      "tree census",
      "tree planting",
    ],
  },
  {
    theme: "buildings",
    queries: [
      "building footprint",
      "POPS",
      "privately owned public",
      "vacant lot",
      "affordable housing",
      "NYCHA",
      "building permit",
      "DOB violation",
      "energy benchmark",
      "sidewalk cafe",
    ],
  },
  {
    theme: "civic",
    queries: [
      "zip code",
      "census tract",
      "community board",
      "congressional district",
      "state senate",
      "state assembly",
      "election district",
      "BID",
      "business improvement district",
      "urban renewal",
    ],
  },
  {
    theme: "safety",
    queries: [
      "fire house",
      "firehouse",
      "FDNY",
      "noise complaint",
      "shooting",
      "vision zero",
      "speed hump",
      "crash",
      "pedestrian",
    ],
  },
  {
    theme: "health",
    queries: [
      "hospital",
      "pharmacy",
      "health center",
      "drug treatment",
      "litter basket",
      "mental health",
      "syringe",
      "drop-off",
    ],
  },
  {
    theme: "education",
    queries: [
      "school zone",
      "charter school",
      "pre-k",
      "preschool",
      "after school",
      "school district",
    ],
  },
  {
    theme: "environment",
    queries: [
      "flood",
      "sea level",
      "coastal",
      "air quality",
      "green infrastructure",
      "tree canopy",
      "stormwater",
      "brownfield",
      "DEC permit",
    ],
  },
  {
    theme: "commerce",
    queries: [
      "sidewalk cafe",
      "food truck",
      "liquor license",
      "filming permit",
      "hotel",
      "newsstand",
      "mobile vending",
      "farmer market",
      "wifi",
    ],
  },
];

async function main() {
  for (const { theme, queries } of QUERIES) {
    console.log(`\n=== ${theme.toUpperCase()} ===`);
    for (const q of queries) {
      const rows = (await sql`
        SELECT dataset_id, name
        FROM datasets
        WHERE has_geometry = true
          AND to_tsvector('english', name || ' ' || coalesce(description, ''))
              @@ websearch_to_tsquery('english', ${q})
        ORDER BY ts_rank(
          to_tsvector('english', name || ' ' || coalesce(description, '')),
          websearch_to_tsquery('english', ${q})
        ) DESC
        LIMIT 4
      `) as Array<{ dataset_id: string; name: string }>;
      if (rows.length === 0) continue;
      console.log(`\n  >>> "${q}"`);
      for (const r of rows) console.log(`    ${r.dataset_id}  ${r.name}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
