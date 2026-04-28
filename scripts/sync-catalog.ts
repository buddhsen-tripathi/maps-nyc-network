import { sql } from "../lib/db";
import { crawlSocrataCatalog } from "../lib/catalog/socrata";

const PAGE_SIZE = 100;
const MAX_PAGES = 30; // safety ceiling, around 3,000 datasets

async function syncNycOpenData() {
  const sourceId = "nyc-open-data";
  const runIdRow = (await sql`
    INSERT INTO sync_runs (source_id) VALUES (${sourceId})
    RETURNING id
  `) as Array<{ id: number }>;
  const runId = runIdRow[0].id;

  let inserted = 0;
  let updated = 0;
  let error: string | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      const { datasets, total } = await crawlSocrataCatalog({
        limit: PAGE_SIZE,
        offset,
        onlyGeospatial: false,
      });

      if (datasets.length === 0) break;

      for (const d of datasets) {
        const result = (await sql`
          INSERT INTO datasets (
            source_id, dataset_id, name, description,
            has_geometry, categories, permalink, source_updated_at, synced_at
          ) VALUES (
            ${d.sourceId}, ${d.datasetId}, ${d.name}, ${d.description ?? null},
            ${d.hasGeometry}, ${d.categories ?? []}, ${d.permalink ?? null},
            ${d.updatedAt ?? null}, now()
          )
          ON CONFLICT (source_id, dataset_id) DO UPDATE SET
            name              = EXCLUDED.name,
            description       = EXCLUDED.description,
            has_geometry      = EXCLUDED.has_geometry,
            categories        = EXCLUDED.categories,
            permalink         = EXCLUDED.permalink,
            source_updated_at = EXCLUDED.source_updated_at,
            synced_at         = EXCLUDED.synced_at
          RETURNING (xmax = 0) AS inserted
        `) as Array<{ inserted: boolean }>;
        if (result[0]?.inserted) inserted++;
        else updated++;
      }

      console.log(
        `[${sourceId}] page ${page + 1}: ${datasets.length} rows (offset ${offset}/${total})`,
      );
      if (offset + datasets.length >= total) break;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error(`[${sourceId}] failed:`, error);
  } finally {
    await sql`
      UPDATE sync_runs
      SET finished_at = now(), inserted = ${inserted}, updated = ${updated}, error = ${error}
      WHERE id = ${runId}
    `;
  }

  console.log(
    `[${sourceId}] done. inserted=${inserted} updated=${updated} error=${error ?? "none"}`,
  );
}

async function main() {
  // NYC Open Data is currently the only auto-discoverable catalog source.
  // DCP, MTA, Citi Bike, ArcGIS, and FEMA need bespoke crawlers and will
  // be wired up incrementally.
  await syncNycOpenData();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
