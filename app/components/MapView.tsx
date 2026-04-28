"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LayerKind, Paint, PopupConfig } from "@/lib/categories/types";
import {
  buildPopupModel,
  googleMapsUrl,
  renderPopupHTML,
} from "@/lib/categories/popup";

const NYC_CENTER: [number, number] = [-73.9857, 40.7484];
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export type ActiveLayer = {
  id: string;
  name: string;
  kind: LayerKind;
  paint: Paint;
  cluster: boolean;
  options: Record<string, string | boolean>;
  popup?: PopupConfig;
};

type LayerState = {
  optionsKey: string;
  abort: AbortController;
  interactiveLayerIds: string[];
  layer: ActiveLayer;
};

export function MapView({ layers }: { layers: ActiveLayer[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const mapReadyRef = useRef(false);
  const stateRef = useRef<Map<string, LayerState>>(new Map());
  const interactiveRef = useRef<Map<string, ActiveLayer>>(new Map());
  const pendingRef = useRef<ActiveLayer[] | null>(null);

  // Mount map + global hover handlers (registered once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: NYC_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 19,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: { compact: true },
      fadeDuration: 200,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true, timeout: 8000 },
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true,
      }),
      "bottom-right",
    );

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      maxWidth: "320px",
      className: "nyc-popup",
    });
    const selectPopup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      offset: 12,
      maxWidth: "320px",
      className: "nyc-popup nyc-popup-selected",
    });
    popupRef.current = hoverPopup;

    let hasSelection = false;
    selectPopup.on("close", () => {
      hasSelection = false;
    });

    map.on("mousemove", (e) => {
      if (hasSelection) return;
      const ids = Array.from(interactiveRef.current.keys());
      if (ids.length === 0) {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
        return;
      }
      const features = map.queryRenderedFeatures(e.point, { layers: ids });
      if (features.length === 0) {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
        return;
      }
      const f = features[0];
      const layerInfo = interactiveRef.current.get(f.layer.id);
      if (!layerInfo) return;
      map.getCanvas().style.cursor = "pointer";
      const model = buildPopupModel(f.properties, {
        name: layerInfo.name,
        popup: layerInfo.popup,
      });
      hoverPopup
        .setLngLat(e.lngLat)
        .setHTML(renderPopupHTML(model, layerInfo.paint.color))
        .addTo(map);
    });

    map.on("mouseout", () => {
      if (hasSelection) return;
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    });

    map.on("click", (e) => {
      const ids = Array.from(interactiveRef.current.keys());
      const features = ids.length
        ? map.queryRenderedFeatures(e.point, { layers: ids })
        : [];
      if (features.length === 0) {
        // Click on empty map clears selection.
        if (hasSelection) selectPopup.remove();
        return;
      }
      const f = features[0];
      const layerInfo = interactiveRef.current.get(f.layer.id);
      if (!layerInfo) return;

      hoverPopup.remove();
      const model = buildPopupModel(f.properties, {
        name: layerInfo.name,
        popup: layerInfo.popup,
      });
      const html = renderPopupHTML(model, layerInfo.paint.color, {
        actions: [
          {
            href: googleMapsUrl(e.lngLat.lng, e.lngLat.lat),
            label: "Open in Google Maps",
          },
        ],
      });
      hasSelection = true;
      selectPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on("load", () => {
      mapReadyRef.current = true;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) syncLayers(map, stateRef.current, interactiveRef.current, pending);
    });

    mapRef.current = map;

    return () => {
      mapReadyRef.current = false;
      hoverPopup.remove();
      selectPopup.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync layers when prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!mapReadyRef.current) {
      pendingRef.current = layers;
      return;
    }
    syncLayers(map, stateRef.current, interactiveRef.current, layers);
  }, [layers]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function syncLayers(
  map: maplibregl.Map,
  state: Map<string, LayerState>,
  interactive: Map<string, ActiveLayer>,
  layers: ActiveLayer[],
) {
  const wantedIds = new Set(layers.map((l) => l.id));

  for (const id of Array.from(state.keys())) {
    if (!wantedIds.has(id)) {
      removeCategory(map, id, state, interactive);
    }
  }

  for (const layer of layers) {
    const optionsKey = JSON.stringify(layer.options);
    const existing = state.get(layer.id);
    if (existing && existing.optionsKey === optionsKey) continue;

    if (existing) removeCategory(map, layer.id, state, interactive);

    const abort = new AbortController();
    state.set(layer.id, {
      optionsKey,
      abort,
      interactiveLayerIds: [],
      layer,
    });

    const url = new URL(`/api/layer/${layer.id}`, window.location.origin);
    for (const [k, v] of Object.entries(layer.options)) {
      url.searchParams.set(k, String(v));
    }

    fetch(url, { signal: abort.signal })
      .then((r) => r.json())
      .then((body: { geojson: GeoJSON.FeatureCollection }) => {
        if (!map.getStyle()) return;
        const ids = addCategory(map, layer, body.geojson);
        const entry = state.get(layer.id);
        if (entry) {
          entry.interactiveLayerIds = ids;
          for (const lid of ids) interactive.set(lid, layer);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn(`Failed to load layer ${layer.id}:`, err);
      });
  }
}

function sourceId(catId: string) {
  return `cat:${catId}`;
}

function removeCategory(
  map: maplibregl.Map,
  id: string,
  state: Map<string, LayerState>,
  interactive: Map<string, ActiveLayer>,
) {
  const entry = state.get(id);
  if (entry) {
    entry.abort.abort();
    for (const lid of entry.interactiveLayerIds) interactive.delete(lid);
  }
  const sid = sourceId(id);
  const layerIds = [
    `${sid}:fill`,
    `${sid}:fill-outline`,
    `${sid}:line`,
    `${sid}:point`,
    `${sid}:cluster`,
    `${sid}:cluster-count`,
  ];
  for (const lid of layerIds) {
    if (map.getLayer(lid)) map.removeLayer(lid);
  }
  if (map.getSource(sid)) map.removeSource(sid);
  state.delete(id);
}

/**
 * Adds source + layers for a category and returns the list of
 * layer ids that should be interactive (hover-able for popups).
 */
function addCategory(
  map: maplibregl.Map,
  layer: ActiveLayer,
  data: GeoJSON.FeatureCollection,
): string[] {
  const sid = sourceId(layer.id);
  if (map.getSource(sid)) return [];

  const cluster = layer.cluster && layer.kind === "points";
  const interactiveIds: string[] = [];

  map.addSource(sid, {
    type: "geojson",
    data,
    ...(cluster
      ? { cluster: true, clusterRadius: 40, clusterMaxZoom: 14 }
      : {}),
  });

  if (layer.kind === "polygons") {
    const fillId = `${sid}:fill`;
    map.addLayer({
      id: fillId,
      type: "fill",
      source: sid,
      paint: {
        "fill-color": layer.paint.color,
        "fill-opacity": layer.paint.opacity ?? 0.2,
      },
    });
    map.addLayer({
      id: `${sid}:fill-outline`,
      type: "line",
      source: sid,
      paint: {
        "line-color": layer.paint.color,
        "line-width": 0.8,
        "line-opacity": 0.6,
      },
    });
    interactiveIds.push(fillId);
  } else if (layer.kind === "lines") {
    const lineId = `${sid}:line`;
    map.addLayer({
      id: lineId,
      type: "line",
      source: sid,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": layer.paint.color,
        "line-width": layer.paint.width ?? 2,
        "line-opacity": layer.paint.opacity ?? 0.9,
      },
    });
    interactiveIds.push(lineId);
  } else {
    if (cluster) {
      map.addLayer({
        id: `${sid}:cluster`,
        type: "circle",
        source: sid,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": layer.paint.color,
          "circle-opacity": 0.45,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            8,
            50,
            12,
            500,
            18,
            5000,
            24,
          ],
          "circle-stroke-color": layer.paint.color,
          "circle-stroke-opacity": 0.9,
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: `${sid}:cluster-count`,
        type: "symbol",
        source: sid,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 10,
        },
        paint: {
          "text-color": "#0a0a0a",
          "text-halo-color": layer.paint.color,
          "text-halo-width": 1,
        },
      });
    }
    const pointId = `${sid}:point`;
    map.addLayer({
      id: pointId,
      type: "circle",
      source: sid,
      filter: cluster ? ["!", ["has", "point_count"]] : ["all"],
      paint: {
        "circle-color": layer.paint.color,
        "circle-radius": layer.paint.radius ?? 3,
        "circle-stroke-color": layer.paint.haloColor ?? "#0a0a0a",
        "circle-stroke-width": 0.8,
        "circle-opacity": 0.9,
      },
    });
    interactiveIds.push(pointId);
  }

  return interactiveIds;
}
