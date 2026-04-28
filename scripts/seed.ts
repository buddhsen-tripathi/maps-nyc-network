/**
 * Seed: load the application's TS registries into the DB.
 *
 *   bun run db:seed
 *
 * Idempotent. Themes, categories, and sources are upserted; a category's
 * dataset wiring is replaced wholesale on each run so removed datasets
 * disappear cleanly.
 */
import { sql } from "../lib/db/connect";
import { THEMES } from "../lib/categories/themes";
import { CATEGORIES } from "../lib/categories/registry";
import { SOURCES } from "../lib/sources/registry";

async function seedThemes() {
  for (const [i, t] of THEMES.entries()) {
    await sql`
      INSERT INTO themes (id, name, icon, sort_order)
      VALUES (${t.id}, ${t.name}, ${t.icon}, ${i})
      ON CONFLICT (id) DO UPDATE SET
        name       = EXCLUDED.name,
        icon       = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order
    `;
  }
  console.log(`themes:     ${THEMES.length}`);
}

async function seedSources() {
  for (const s of SOURCES) {
    await sql`
      INSERT INTO sources (
        id, name, agency, protocol, endpoint, homepage,
        description, refresh, attribution, license
      ) VALUES (
        ${s.id}, ${s.name}, ${s.agency}, ${s.protocol}, ${s.endpoint},
        ${s.homepage ?? null}, ${s.description}, ${s.refresh},
        ${s.attribution}, ${s.license ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        name        = EXCLUDED.name,
        agency      = EXCLUDED.agency,
        protocol    = EXCLUDED.protocol,
        endpoint    = EXCLUDED.endpoint,
        homepage    = EXCLUDED.homepage,
        description = EXCLUDED.description,
        refresh     = EXCLUDED.refresh,
        attribution = EXCLUDED.attribution,
        license     = EXCLUDED.license
    `;
  }
  console.log(`sources:    ${SOURCES.length}`);
}

async function seedCategories() {
  let datasetWires = 0;
  for (const [i, c] of CATEGORIES.entries()) {
    await sql`
      INSERT INTO categories (
        id, name, theme_id, icon, description, kind, cluster,
        paint, popup, options, sort_order
      ) VALUES (
        ${c.id}, ${c.name}, ${c.theme}, ${c.icon}, ${c.description},
        ${c.kind}, ${c.cluster ?? false},
        ${JSON.stringify(c.paint)}::jsonb,
        ${c.popup ? JSON.stringify(c.popup) : null}::jsonb,
        ${c.options ? JSON.stringify(c.options) : null}::jsonb,
        ${i}
      )
      ON CONFLICT (id) DO UPDATE SET
        name        = EXCLUDED.name,
        theme_id    = EXCLUDED.theme_id,
        icon        = EXCLUDED.icon,
        description = EXCLUDED.description,
        kind        = EXCLUDED.kind,
        cluster     = EXCLUDED.cluster,
        paint       = EXCLUDED.paint,
        popup       = EXCLUDED.popup,
        options     = EXCLUDED.options,
        sort_order  = EXCLUDED.sort_order
    `;

    await sql`DELETE FROM category_datasets WHERE category_id = ${c.id}`;
    for (const [j, ds] of c.datasets.entries()) {
      await sql`
        INSERT INTO category_datasets (category_id, position, spec)
        VALUES (${c.id}, ${j}, ${JSON.stringify(ds)}::jsonb)
      `;
      datasetWires++;
    }
  }
  console.log(`categories: ${CATEGORIES.length}`);
  console.log(`wires:      ${datasetWires}`);
}

async function main() {
  await seedThemes();
  await seedSources();
  await seedCategories();
  console.log("seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
