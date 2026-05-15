import { NextResponse } from "next/server";
import { CATEGORIES_BY_ID } from "@/lib/categories/registry";
import {
  fetchDataset,
  filterByKind,
  mergeCollections,
} from "@/lib/categories/fetchers";
import { memoize } from "@/lib/cache";

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

  const isLive = category.datasets.some(
    (d) => d.protocol === "gbfs" || d.protocol === "gtfs-rt",
  );
  // 30s for live feeds (matches client poll interval), 15min for static.
  // The static TTL is intentionally longer than max-age so that, during the
  // stale-while-revalidate window, the single background refresh that hits
  // origin gets a fast in-memory hit instead of re-fetching from Socrata.
  const ttlMs = isLive ? 30_000 : 15 * 60_000;

  // Stable cache key from category id + sorted option entries.
  const optsKey = Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const cacheKey = `layer:${id}:${optsKey}`;

  try {
    const payload = await memoize(cacheKey, ttlMs, async () => {
      const collections = await Promise.all(
        category.datasets.map((ds) => fetchDataset(ds, options)),
      );
      const merged = mergeCollections(collections);
      const filtered = filterByKind(merged, category.kind);
      return {
        id: category.id,
        kind: category.kind,
        paint: category.paint,
        cluster: category.cluster ?? false,
        refresh: category.refresh ?? 0,
        geojson: filtered,
        count: filtered.features.length,
      };
    });

    const res = NextResponse.json(payload);
    // Live feeds: 30s fresh + 2min SWR matches the client refresh cadence.
    // Static: 5min fresh + 24h SWR. Short max-age keeps the edge refreshing
    // often; long SWR means a user request never waits for origin again
    // after the first hit. `s-maxage` overrides max-age at CDN edges.
    res.headers.set(
      "Cache-Control",
      isLive
        ? "public, max-age=30, s-maxage=30, stale-while-revalidate=120"
        : "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    );
    return res;
  } catch (err) {
    console.error(`/api/layer/${id} failed:`, err);
    return NextResponse.json({ error: "Layer fetch failed" }, { status: 500 });
  }
}
