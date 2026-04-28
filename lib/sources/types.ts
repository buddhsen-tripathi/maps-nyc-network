export type Protocol =
  | "socrata"
  | "arcgis-rest"
  | "gtfs-static"
  | "gtfs-realtime"
  | "gbfs"
  | "shapefile-bulk"
  | "geojson-bulk";

export type RefreshCadence =
  | "realtime"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "irregular";

export type Source = {
  id: string;
  name: string;
  agency: string;
  protocol: Protocol;
  endpoint: string;
  homepage?: string;
  description: string;
  refresh: RefreshCadence;
  attribution: string;
  license?: string;
};

export type DatasetSummary = {
  sourceId: string;
  datasetId: string;
  name: string;
  description?: string;
  updatedAt?: string;
  rowCount?: number;
  hasGeometry: boolean;
  categories?: string[];
  permalink?: string;
};
