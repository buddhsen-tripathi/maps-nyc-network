export type ThemeId =
  | "transit"
  | "nature"
  | "buildings"
  | "civic"
  | "safety"
  | "health"
  | "education"
  | "environment"
  | "commerce";

export type LayerKind = "points" | "lines" | "polygons";

export type SocrataDataset = {
  protocol: "socrata";
  domain: string; // e.g. data.cityofnewyork.us
  id: string; // 4x4 dataset id
  limit?: number;
  where?: string; // SoQL $where
  select?: string; // SoQL $select
};

export type GbfsDataset = {
  protocol: "gbfs";
  url: string; // station_information.json
  statusUrl?: string; // station_status.json, merged into properties by station_id
};

export type ArcgisDataset = {
  protocol: "arcgis";
  url: string; // FeatureServer/{n}/query base
};

export type GtfsRtDataset = {
  protocol: "gtfs-rt";
  feedUrls: string[]; // one or more GTFS-RT feed URLs
  apiKeyHeader?: string; // header name for the API key (e.g. "x-api-key")
  apiKeyEnv?: string; // env var holding the key (e.g. "MTA_API_KEY")
  entity: "vehicle" | "alert" | "trip-update";
  /**
   * Fallback for vehicles missing GPS positions (e.g. subway in tunnels).
   * Looks up coordinates by stop_id from a Socrata stops dataset.
   */
  stopsLookup?: {
    domain: string;
    datasetId: string;
    idField: string;
    latField: string;
    lngField: string;
    nameField?: string;
    /** Strip GTFS-RT direction suffix (N/S) when matching base stop ids. */
    stripDirectionSuffix?: boolean;
  };
};

export type CategoryDataset =
  | SocrataDataset
  | GbfsDataset
  | ArcgisDataset
  | GtfsRtDataset;

export type CategoryOption =
  | {
      id: string;
      label: string;
      type: "toggle";
      default: boolean;
    }
  | {
      id: string;
      label: string;
      type: "select";
      default: string;
      choices: { value: string; label: string }[];
    };

export type Paint = {
  color: string;
  haloColor?: string;
  radius?: number; // points
  width?: number; // lines
  opacity?: number; // fills
};

export type PopupField = {
  key: string;
  label: string;
};

export type PopupConfig = {
  /**
   * Title spec. Either a single property key (e.g. "spc_common") or a
   * template string with {key} placeholders (e.g. "Council District {coundist}").
   */
  title?: string;
  fields?: PopupField[];
};

export type Category = {
  id: string;
  name: string;
  theme: ThemeId;
  icon: string; // phosphor icon name
  description: string;
  kind: LayerKind;
  cluster?: boolean;
  datasets: CategoryDataset[];
  paint: Paint;
  options?: CategoryOption[];
  popup?: PopupConfig;
  /** Auto-refresh interval in seconds for live feeds (e.g. 30 for GTFS-RT). */
  refresh?: number;
  /**
   * Smoothly animate point positions between refreshes. Requires kind="points"
   * and a stable per-feature id property. Defaults to 90% of refresh interval.
   */
  tween?: {
    idKey: string;
    durationMs?: number;
  };
};

export type Theme = {
  id: ThemeId;
  name: string;
  icon: string;
};
