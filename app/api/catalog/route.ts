import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import type { DatasetSummary } from "@/lib/sources/types";

type DbRow = {
  source_id: string;
  dataset_id: string;
  name: string;
  description: string | null;
  has_geometry: boolean;
  categories: string[];
  permalink: string | null;
  source_updated_at: string | null;
  total: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 25), 1),
    100,
  );
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const onlyGeospatial = url.searchParams.get("geo") !== "false";
  const sourceId = url.searchParams.get("source");

  try {
    const rows = (await sql`
      SELECT
        d.source_id, d.dataset_id, d.name, d.description, d.has_geometry,
        d.categories, d.permalink, d.source_updated_at,
        count(*) OVER() AS total
      FROM datasets d
      WHERE
        (${onlyGeospatial}::boolean = false OR d.has_geometry = true)
        AND (${sourceId}::text IS NULL OR d.source_id = ${sourceId}::text)
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
        END DESC,
        d.source_updated_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `) as DbRow[];

    const datasets: DatasetSummary[] = rows.map((r) => ({
      sourceId: r.source_id,
      datasetId: r.dataset_id,
      name: r.name,
      description: r.description ?? undefined,
      hasGeometry: r.has_geometry,
      categories: r.categories,
      permalink: r.permalink ?? undefined,
      updatedAt: r.source_updated_at ?? undefined,
    }));

    const total = rows[0] ? Number(rows[0].total) : 0;

    const res = NextResponse.json({ total, datasets });
    // Catalog refreshes via cron; 5 min fresh + stale-while-revalidate is
    // plenty for fast repeat searches without staleness concerns.
    res.headers.set(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=3600",
    );
    return res;
  } catch (err) {
    console.error("/api/catalog query failed:", err);
    return NextResponse.json(
      { error: "Catalog query failed" },
      { status: 500 },
    );
  }
}
