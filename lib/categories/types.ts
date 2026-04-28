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
};

export type ArcgisDataset = {
  protocol: "arcgis";
  url: string; // FeatureServer/{n}/query base
};

export type CategoryDataset = SocrataDataset | GbfsDataset | ArcgisDataset;

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
};

export type Theme = {
  id: ThemeId;
  name: string;
  icon: string;
};
