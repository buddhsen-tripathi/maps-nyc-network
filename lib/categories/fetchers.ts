import GtfsRealtimeBindings from "gtfs-realtime-bindings";
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
      case "gtfs-rt":
        return await fetchGtfsRt(ds);
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

  // Property-equality filter (passed by the agent or by /api/layer query
  // params). Restricted to Socrata-safe identifier characters and a
  // single-quote escaped value. ANDed with any pre-set where clause.
  const matchField = options.match_field;
  const matchValue = options.match_value;
  if (
    typeof matchField === "string" &&
    typeof matchValue === "string" &&
    /^[a-z_][a-z0-9_]*$/i.test(matchField)
  ) {
    const safeValue = String(matchValue).replace(/'/g, "''");
    const clause = `${matchField}='${safeValue}'`;
    where = where ? `(${where}) AND (${clause})` : clause;
  }

  if (where) url.searchParams.set("$where", where);
  if (ds.select) url.searchParams.set("$select", ds.select);

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Socrata ${ds.id}: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as FeatureCollection;

  // Some Socrata datasets keep lat/lng in properties with null geometry.
  // Synthesize a Point so the popup and map rendering work uniformly.
  for (const f of body.features) {
    if (f.geometry) continue;
    const p = f.properties as Record<string, unknown> | null;
    if (!p) continue;
    const lat = parseFloat(
      String(p.gis_latitude ?? p.latitude ?? p.lat ?? ""),
    );
    const lng = parseFloat(
      String(p.gis_longitude ?? p.longitude ?? p.lng ?? p.lon ?? ""),
    );
    if (!isNaN(lat) && !isNaN(lng)) {
      f.geometry = { type: "Point", coordinates: [lng, lat] };
    }
  }

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
  type GbfsStatus = {
    station_id: string;
    num_bikes_available?: number;
    num_ebikes_available?: number;
    num_docks_available?: number;
    is_renting?: number | boolean;
    is_returning?: number | boolean;
    is_installed?: number | boolean;
    last_reported?: number;
  };
  type GbfsBody<T> = { data: { stations: T[] } };

  const res = await fetch(ds.url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`GBFS ${ds.url}: ${res.status}`);
  const body = (await res.json()) as GbfsBody<GbfsStation>;

  const statusById = new Map<string, GbfsStatus>();
  if (ds.statusUrl) {
    const sres = await fetch(ds.statusUrl, { next: { revalidate: 60 } });
    if (sres.ok) {
      const sbody = (await sres.json()) as GbfsBody<GbfsStatus>;
      for (const st of sbody.data.stations) {
        statusById.set(st.station_id, st);
      }
    }
  }

  return {
    type: "FeatureCollection",
    features: body.data.stations.map((s) => {
      const st = statusById.get(s.station_id);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
        properties: {
          name: s.name,
          capacity: s.capacity,
          ...(st && {
            num_bikes_available: st.num_bikes_available,
            num_ebikes_available: st.num_ebikes_available,
            num_docks_available: st.num_docks_available,
            is_renting: Boolean(st.is_renting),
            is_returning: Boolean(st.is_returning),
          }),
        },
      };
    }),
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

// Module-scoped cache so we don't re-fetch the stops table per layer request.
type StopInfo = { lng: number; lat: number; name?: string };
const stopsCache = new Map<string, Promise<Map<string, StopInfo>>>();

async function loadStopsLookup(
  cfg: NonNullable<
    Extract<CategoryDataset, { protocol: "gtfs-rt" }>["stopsLookup"]
  >,
): Promise<Map<string, StopInfo>> {
  const key = `${cfg.domain}/${cfg.datasetId}`;
  let pending = stopsCache.get(key);
  if (pending) return pending;

  pending = (async () => {
    // Socrata requires literal $limit; URL.searchParams percent-encodes $ which 500s.
    const url = `https://${cfg.domain}/resource/${cfg.datasetId}.json?$limit=5000`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      throw new Error(`Stops lookup ${cfg.datasetId}: ${res.status}`);
    }
    const rows = (await res.json()) as Record<string, unknown>[];
    const map = new Map<string, StopInfo>();
    for (const r of rows) {
      const idRaw = r[cfg.idField];
      const lat = Number(r[cfg.latField]);
      const lng = Number(r[cfg.lngField]);
      if (idRaw == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const name = cfg.nameField
        ? (r[cfg.nameField] as string | undefined)
        : undefined;
      // Field may be a single id ("123") or CSV ("123,456,A02") for transfer complexes.
      for (const id of String(idRaw).split(",")) {
        const trimmed = id.trim();
        if (trimmed) map.set(trimmed, { lng, lat, name });
      }
    }
    return map;
  })();

  stopsCache.set(key, pending);
  // If the load fails, drop the cache so the next request retries.
  pending.catch(() => stopsCache.delete(key));
  return pending;
}

async function fetchGtfsRt(
  ds: Extract<CategoryDataset, { protocol: "gtfs-rt" }>,
): Promise<FeatureCollection> {
  const headers: Record<string, string> = {};
  if (ds.apiKeyHeader && ds.apiKeyEnv) {
    const key = process.env[ds.apiKeyEnv];
    if (key) headers[ds.apiKeyHeader] = key;
  }

  const stopsPromise = ds.stopsLookup ? loadStopsLookup(ds.stopsLookup) : null;
  const stripSuffix = ds.stopsLookup?.stripDirectionSuffix ?? false;

  const allFeatures: GeoJSON.Feature[] = [];

  await Promise.all(
    ds.feedUrls.map(async (feedUrl) => {
      const res = await fetch(feedUrl, {
        headers,
        next: { revalidate: 30 },
      });
      if (!res.ok) {
        console.warn(`GTFS-RT ${feedUrl}: ${res.status}`);
        return;
      }
      const buffer = await res.arrayBuffer();
      const feed =
        GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(buffer),
        );

      const stops = stopsPromise ? await stopsPromise : null;

      for (const entity of feed.entity) {
        if (ds.entity === "vehicle" && entity.vehicle) {
          const v = entity.vehicle;
          const pos = v.position;
          let lat: number | null = pos?.latitude ?? null;
          let lng: number | null = pos?.longitude ?? null;
          let stopName: string | undefined;

          // Subway in tunnels reports no GPS; fall back to next-stop coords.
          if ((lat == null || lng == null) && stops && v.stopId) {
            const lookupId = stripSuffix
              ? v.stopId.replace(/[NS]$/, "")
              : v.stopId;
            const info = stops.get(lookupId);
            if (info) {
              lat = info.lat;
              lng = info.lng;
              stopName = info.name;
            }
          }

          if (lat == null || lng == null) continue;
          allFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lng, lat] },
            properties: {
              vehicle_id: v.vehicle?.id ?? entity.id ?? null,
              route_id: v.trip?.routeId ?? null,
              trip_id: v.trip?.tripId ?? null,
              direction_id: v.trip?.directionId ?? null,
              stop_id: v.stopId ?? null,
              stop_name: stopName ?? null,
              current_status:
                v.currentStatus != null
                  ? ["INCOMING_AT", "STOPPED_AT", "IN_TRANSIT_TO"][
                      v.currentStatus
                    ] ?? String(v.currentStatus)
                  : null,
              bearing: pos?.bearing ?? null,
              speed: pos?.speed ?? null,
              timestamp: v.timestamp ? Number(v.timestamp) : null,
            },
          });
        }
      }
    }),
  );

  return { type: "FeatureCollection", features: allFeatures };
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
