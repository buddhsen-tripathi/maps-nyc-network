/**
 * NYC GeoSearch (Pelias), free, no auth required, NYC-focused.
 * https://geosearch.planninglabs.nyc/
 *
 * Used to convert event venue strings into lat/lng so the agent can plot
 * results on the map.
 */

type GeoSearchResponse = {
  features?: Array<{
    geometry?: { coordinates?: [number, number] }; // [lng, lat]
    properties?: { label?: string; confidence?: number };
  }>;
};

export type GeoCoords = { lat: number; lng: number; label?: string };

const GEOSEARCH_URL = "https://geosearch.planninglabs.nyc/v2/search";

export async function geocodeNyc(query: string): Promise<GeoCoords | null> {
  if (!query.trim()) return null;
  try {
    const url = `${GEOSEARCH_URL}?text=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, {
      // 24h cache, venues don't move
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoSearchResponse;
    const f = data.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const [lng, lat] = coords;
    return { lat, lng, label: f?.properties?.label };
  } catch {
    return null;
  }
}

/** Geocode an event by trying the most specific query first, then loosening. */
export async function geocodeEvent(opts: {
  venue?: string;
  neighborhood?: string;
  borough?: string;
  name?: string;
}): Promise<GeoCoords | null> {
  const queries: string[] = [];
  if (opts.venue && opts.neighborhood)
    queries.push(`${opts.venue}, ${opts.neighborhood}, NYC`);
  if (opts.venue && opts.borough)
    queries.push(`${opts.venue}, ${opts.borough}, NYC`);
  if (opts.venue) queries.push(`${opts.venue}, NYC`);
  if (opts.name && opts.neighborhood)
    queries.push(`${opts.name}, ${opts.neighborhood}, NYC`);
  if (opts.neighborhood) queries.push(`${opts.neighborhood}, NYC`);

  for (const q of queries) {
    const result = await geocodeNyc(q);
    if (result) return result;
  }
  return null;
}
