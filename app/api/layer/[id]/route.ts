import { NextResponse } from "next/server";
import { CATEGORIES_BY_ID } from "@/lib/categories/registry";
import {
  fetchDataset,
  filterByKind,
  mergeCollections,
} from "@/lib/categories/fetchers";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const category = CATEGORIES_BY_ID.get(id);
  if (!category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  }

  const url = new URL(req.url);
  const options: Record<string, string | boolean> = {};
  for (const [k, v] of url.searchParams.entries()) options[k] = v;

  const collections = await Promise.all(
    category.datasets.map((ds) => fetchDataset(ds, options)),
  );

  const merged = mergeCollections(collections);
  const filtered = filterByKind(merged, category.kind);

  const res = NextResponse.json({
    id: category.id,
    kind: category.kind,
    paint: category.paint,
    cluster: category.cluster ?? false,
    geojson: filtered,
    count: filtered.features.length,
  });

  // Live feeds (Citi Bike GBFS, MTA realtime) need a short cache; everything
  // else changes daily at most, so cache hard with stale-while-revalidate.
  const isLive = category.datasets.some((d) => d.protocol === "gbfs");
  res.headers.set(
    "Cache-Control",
    isLive
      ? "public, max-age=60, stale-while-revalidate=300"
      : "public, max-age=3600, stale-while-revalidate=86400",
  );
  return res;
}
