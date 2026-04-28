import type { CategoryDataset, LayerKind } from "./types";

export type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
};

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Fetch GeoJSON for a single underlying dataset, normalized per protocol.
 * Returns an empty FC on failure so one bad dataset never breaks a category.
 */
export async function fetchDataset(
  ds: CategoryDataset,
  options: Record<string, string | boolean>,
): Promise<FeatureCollection> {
  try {
    switch (ds.protocol) {
      case "socrata":
        return await fetchSocrata(ds, options);
      case "gbfs":
        return await fetchGbfs(ds);
      case "arcgis":
        return await fetchArcgis(ds);
    }
  } catch (err) {
    console.warn(`fetchDataset failed:`, err);
    return EMPTY;
  }
}

async function fetchSocrata(
  ds: Extract<CategoryDataset, { protocol: "socrata" }>,
  options: Record<string, string | boolean>,
): Promise<FeatureCollection> {
  const url = new URL(`https://${ds.domain}/resource/${ds.id}.geojson`);
  if (ds.limit) url.searchParams.set("$limit", String(ds.limit));
  let where = ds.where;
  if (options.status === "all" && where?.includes("status=")) {
    where = undefined;
  }
  if (where) url.searchParams.set("$where", where);
  if (ds.select) url.searchParams.set("$select", ds.select);

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Socrata ${ds.id}: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as FeatureCollection;
  return body;
}

async function fetchGbfs(
  ds: Extract<CategoryDataset, { protocol: "gbfs" }>,
): Promise<FeatureCollection> {
  type GbfsStation = {
    station_id: string;
    name: string;
    lat: number;
    lon: number;
    capacity?: number;
  };
  type GbfsBody = { data: { stations: GbfsStation[] } };

  const res = await fetch(ds.url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`GBFS ${ds.url}: ${res.status}`);
  const body = (await res.json()) as GbfsBody;

  return {
    type: "FeatureCollection",
    features: body.data.stations.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        id: s.station_id,
        name: s.name,
        capacity: s.capacity,
      },
    })),
  };
}

async function fetchArcgis(
  ds: Extract<CategoryDataset, { protocol: "arcgis" }>,
): Promise<FeatureCollection> {
  const url = new URL(`${ds.url}/query`);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("f", "geojson");
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`ArcGIS ${ds.url}: ${res.status}`);
  return (await res.json()) as FeatureCollection;
}

/**
 * Filter features to a target geometry kind. A category may legitimately
 * pull mixed geometry datasets; the map renders one kind per category layer.
 */
export function filterByKind(
  fc: FeatureCollection,
  kind: LayerKind,
): FeatureCollection {
  const wanted = ({
    points: ["Point", "MultiPoint"],
    lines: ["LineString", "MultiLineString"],
    polygons: ["Polygon", "MultiPolygon"],
  } as const)[kind];

  return {
    type: "FeatureCollection",
    features: fc.features.filter(
      (f) => f.geometry && wanted.includes(f.geometry.type as never),
    ),
  };
}

export function mergeCollections(
  collections: FeatureCollection[],
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((c) => c.features),
  };
}
