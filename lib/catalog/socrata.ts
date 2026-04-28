import type { DatasetSummary } from "../sources/types";

const SOCRATA_DISCOVERY = "https://api.us.socrata.com/api/catalog/v1";

type SocrataResource = {
  id: string;
  name: string;
  description?: string;
  updatedAt?: string;
  columns_field_name?: string[];
  columns_datatype?: string[];
  page_views?: { page_views_total?: number };
};

type SocrataResult = {
  resource: SocrataResource;
  classification?: { domain_category?: string; categories?: string[] };
  permalink?: string;
  link?: string;
};

type SocrataResponse = {
  results: SocrataResult[];
  resultSetSize: number;
};

const GEOMETRY_DATATYPES = new Set([
  "Point",
  "Line",
  "Polygon",
  "MultiPoint",
  "MultiLine",
  "MultiPolygon",
  "Location",
  "Geospatial",
]);

function detectGeometry(resource: SocrataResource): boolean {
  const types = resource.columns_datatype ?? [];
  return types.some((t) => GEOMETRY_DATATYPES.has(t));
}

export type CrawlOptions = {
  domain?: string;
  query?: string;
  limit?: number;
  offset?: number;
  onlyGeospatial?: boolean;
};

export async function crawlSocrataCatalog({
  domain = "data.cityofnewyork.us",
  query,
  limit = 50,
  offset = 0,
  onlyGeospatial = true,
}: CrawlOptions = {}): Promise<{
  total: number;
  datasets: DatasetSummary[];
}> {
  const params = new URLSearchParams({
    domains: domain,
    limit: String(limit),
    offset: String(offset),
    only: "datasets",
  });
  if (query) params.set("q", query);

  const url = `${SOCRATA_DISCOVERY}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(
      `Socrata discovery failed: ${res.status} ${res.statusText}`,
    );
  }

  const body = (await res.json()) as SocrataResponse;

  const datasets: DatasetSummary[] = body.results
    .map<DatasetSummary>((r) => ({
      sourceId: "nyc-open-data",
      datasetId: r.resource.id,
      name: r.resource.name,
      description: r.resource.description,
      updatedAt: r.resource.updatedAt,
      hasGeometry: detectGeometry(r.resource),
      categories: r.classification?.categories,
      permalink: r.permalink ?? r.link,
    }))
    .filter((d) => (onlyGeospatial ? d.hasGeometry : true));

  return { total: body.resultSetSize, datasets };
}
