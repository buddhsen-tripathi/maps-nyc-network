# Block Maps

Every public NYC map, in one place. Hosted at **maps.nyc.network**.

Block Maps aggregates geospatial data across NYC agencies (Open Data, DCP,
DOT, MTA, FEMA, GBFS, and more) into themed meta-maps such as Trees, Subway,
Floods, and Boroughs, served through a single map UI. A natural-language
agent over the catalog is the long-term differentiator.

## Stack

- Next.js 16 (App Router) + React 19 + Tailwind v4
- MapLibre GL on OpenFreeMap dark vector tiles
- Postgres (Neon) for the dataset catalog, synced from Socrata Discovery
- Bun runtime

## Getting started

```bash
bun install
cp .env.example .env.local        # then fill DATABASE_URL
bun run db:migrate                # creates catalog tables
bun run db:sync                   # populates catalog from NYC Open Data
bun run dev
```

`DATABASE_URL` is required and must point at a Postgres instance you control.
The codebase uses the `@neondatabase/serverless` driver and is built against
[Neon Postgres](https://neon.tech), but any Postgres 14+ instance works.

## Project layout

| Path | Purpose |
|------|---------|
| [app/components/](app/components/) | Workspace, CategoryPanel, MapView, SourcesButton |
| [app/api/](app/api/) | `/categories`, `/layer/[id]`, `/catalog`, `/sources` route handlers |
| [lib/categories/](lib/categories/) | Themes, category registry, fetchers, popup formatter |
| [lib/sources/](lib/sources/) | Ingestion source registry |
| [lib/db/](lib/db/) | Neon client + `schema.sql` |
| [scripts/](scripts/) | `migrate`, `sync-catalog`, `find-datasets`, `verify-datasets` |

## Adding a category

A category is a curated meta-map that clubs one or more underlying datasets
into a single visual layer. To add one, edit
[lib/categories/registry.ts](lib/categories/registry.ts) and append a config:

```ts
{
  id: "ferries",
  name: "NYC Ferry",
  theme: "transit",
  icon: "Boat",
  description: "NYC Ferry routes and terminals.",
  kind: "points",
  datasets: [{ protocol: "socrata", domain: "data.cityofnewyork.us", id: "xxxx-xxxx" }],
  paint: { color: "#06b6d4", radius: 3 },
}
```

Use [scripts/find-datasets.ts](scripts/find-datasets.ts) to locate candidate
dataset ids in the catalog and [scripts/verify-datasets.ts](scripts/verify-datasets.ts)
to confirm they expose GeoJSON.

## Data attribution

All data displayed in Block Maps comes from public sources. By using Block
Maps you agree to abide by each upstream source's terms.

- **NYC Open Data** (data.cityofnewyork.us): public-domain equivalent;
  see the [NYC Open Data terms of use](https://www.nyc.gov/home/terms-of-use.page).
- **MTA developer feeds**: Metropolitan Transportation Authority.
- **Citi Bike GBFS**: NYC Bike Share / Lyft.
- **FEMA NFHL**: U.S. Federal Emergency Management Agency.
- **OpenFreeMap basemap**: OpenStreetMap contributors, served by
  [OpenFreeMap](https://openfreemap.org/).
- **MapLibre GL**: BSD-3-Clause licensed.

## Contributing

Pull requests welcome. Please:

- Run `bun run lint` and `bunx tsc --noEmit` before opening a PR.
- Verify any new dataset ids with `bun run scripts/verify-datasets.ts`.
- Avoid em dashes in code, docs, and copy. Style preference for the project.

## License

[MIT](LICENSE).
