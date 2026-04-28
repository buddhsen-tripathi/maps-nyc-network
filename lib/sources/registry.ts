import type { Source } from "./types";

export const SOURCES: Source[] = [
  {
    id: "nyc-open-data",
    name: "NYC Open Data",
    agency: "NYC Office of Technology and Innovation (OTI)",
    protocol: "socrata",
    endpoint: "https://data.cityofnewyork.us",
    homepage: "https://opendata.cityofnewyork.us",
    description:
      "City-wide open data portal. ~2,500 datasets across every agency; hundreds carry geometry and are queryable as GeoJSON via the SODA API.",
    refresh: "daily",
    attribution: "NYC Open Data",
    license: "https://www.nyc.gov/home/terms-of-use.page",
  },
  {
    id: "dcp-bytes",
    name: "Bytes of the Big Apple",
    agency: "NYC Department of City Planning",
    protocol: "shapefile-bulk",
    endpoint: "https://www.nyc.gov/site/planning/data-maps/open-data.page",
    description:
      "DCP's bulk geospatial release: MapPLUTO (every tax lot), PLUTO, LION (street centerlines), zoning districts, political and administrative boundaries.",
    refresh: "quarterly",
    attribution: "NYC Department of City Planning",
  },
  {
    id: "mta-gtfs-static",
    name: "MTA GTFS (static)",
    agency: "Metropolitan Transportation Authority",
    protocol: "gtfs-static",
    endpoint: "https://api.mta.info/#/landing",
    homepage: "https://new.mta.info/developers",
    description:
      "Static schedule and route geometry for subway, bus, LIRR, and Metro-North in GTFS format.",
    refresh: "weekly",
    attribution: "Metropolitan Transportation Authority",
  },
  {
    id: "mta-gtfs-rt",
    name: "MTA GTFS-realtime",
    agency: "Metropolitan Transportation Authority",
    protocol: "gtfs-realtime",
    endpoint: "https://api.mta.info/#/subwayRealTimeFeeds",
    description:
      "Real-time vehicle positions, trip updates, and service alerts via GTFS-realtime protobuf feeds.",
    refresh: "realtime",
    attribution: "Metropolitan Transportation Authority",
  },
  {
    id: "citi-bike-gbfs",
    name: "Citi Bike GBFS",
    agency: "NYC Bike Share / Lyft",
    protocol: "gbfs",
    endpoint: "https://gbfs.citibikenyc.com/gbfs/gbfs.json",
    homepage: "https://citibikenyc.com/system-data",
    description:
      "Standard GBFS feed: station information, station status (live availability), free bike status, system regions.",
    refresh: "realtime",
    attribution: "Citi Bike / NYC Bike Share",
  },
  {
    id: "nyc-gis-arcgis",
    name: "NYC GIS ArcGIS Services",
    agency: "NYC OTI / DoITT",
    protocol: "arcgis-rest",
    endpoint: "https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services",
    description:
      "City ArcGIS REST endpoints: orthoimagery, address points, building footprints, planimetric basemap.",
    refresh: "annual",
    attribution: "NYC OTI / DoITT",
  },
  {
    id: "fema-nfhl",
    name: "FEMA National Flood Hazard Layer",
    agency: "FEMA",
    protocol: "arcgis-rest",
    endpoint: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
    homepage: "https://hazards.fema.gov/femaportal/wps/portal/NFHLWMS",
    description:
      "FEMA flood hazard zones (special flood hazard areas, base flood elevations) as ArcGIS REST feature services. NYC sea-level overlays layered on top.",
    refresh: "irregular",
    attribution: "FEMA",
  },
];

export const SOURCES_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));
