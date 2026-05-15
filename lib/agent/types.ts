import type { LayerKind } from "@/lib/categories/types";

// ── Map commands emitted by agent tools, consumed by Workspace ──

/** Optional spatial + property filter on a layer. */
export type LayerFilter = {
  /** Spatial: only features within radius of center. */
  center?: [number, number]; // [lng, lat]
  radiusMeters?: number;
  /** Property: equality match against a single feature property. */
  propertyMatch?: { field: string; value: string };
};

export type AddLayerCommand = {
  action: "addLayer";
  categoryId: string;
  options?: Record<string, string | boolean>;
  filter?: LayerFilter;
};

export type RemoveLayerCommand = {
  action: "removeLayer";
  categoryId: string;
};

export type RemoveAllLayersCommand = {
  action: "removeAllLayers";
};

export type FlyToCommand = {
  action: "flyTo";
  center: [number, number]; // [lng, lat]
  zoom?: number;
};

export type FitBoundsCommand = {
  action: "fitBounds";
  bounds: [[number, number], [number, number]]; // [sw, ne]
};

/** A pin to drop on the map for agent results that don't fit the layer model. */
export type AgentMarker = {
  id: string;
  lng: number;
  lat: number;
  title: string;
  subtitle?: string;
  description?: string;
  url?: string;
  category?: string;
};

export type ShowMarkersCommand = {
  action: "showMarkers";
  markers: AgentMarker[];
  /** A label for the marker group (e.g. "Events tonight"). */
  label?: string;
  /** If true, fits the map to the marker bounds. Defaults to true. */
  fit?: boolean;
};

export type ClearMarkersCommand = {
  action: "clearMarkers";
};

export type MapCommand =
  | AddLayerCommand
  | RemoveLayerCommand
  | RemoveAllLayersCommand
  | FlyToCommand
  | FitBoundsCommand
  | ShowMarkersCommand
  | ClearMarkersCommand;

// ── Tool output shapes (used by frontend to detect map commands) ──

export type AddLayerOutput = {
  added: true;
  categoryId: string;
  name: string;
  kind: LayerKind;
};

export type RemoveLayerOutput = {
  removed: true;
  target: string; // categoryId or "all"
};

export type FlyToOutput = {
  center: [number, number];
  zoom: number;
  locationName: string;
};

export type SearchCategoriesOutput = Array<{
  id: string;
  name: string;
  theme: string;
  kind: LayerKind;
  description: string;
}>;

export type SearchCatalogOutput = {
  total: number;
  datasets: Array<{
    datasetId: string;
    name: string;
    description: string;
    hasGeometry: boolean;
  }>;
};

export type FetchDatasetDirectOutput = {
  datasetId: string;
  featureCount: number;
  sampleProperties: string[];
  geometryType: string | null;
};

export type SummarizeFeaturesOutput = {
  categoryId: string;
  total: number;
  groups?: Record<string, number>;
  sampleProperties?: string[];
};
