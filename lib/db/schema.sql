-- Block Maps database schema. Idempotent.
--
-- Conceptual model:
--   themes              top-level grouping shown in the sidebar
--   categories          user-facing meta-maps; each belongs to a theme
--   category_datasets   wiring: which underlying datasets feed a category
--   sources             ingestion sources (NYC Open Data, GBFS, MTA, FEMA)
--   datasets            raw discovery catalog from NYC Open Data Socrata

-- Legacy: drop the old observability log; we don't track sync runs anymore.
DROP TABLE IF EXISTS sync_runs;

-- =========================================================================
-- Catalog: every dataset discovered on NYC Open Data via Socrata Discovery.
-- =========================================================================
CREATE TABLE IF NOT EXISTS datasets (
  source_id          text NOT NULL,
  dataset_id         text NOT NULL,
  name               text NOT NULL,
  description        text,
  has_geometry       boolean NOT NULL DEFAULT false,
  categories         text[] NOT NULL DEFAULT '{}',
  permalink          text,
  source_updated_at  timestamptz,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, dataset_id)
);

CREATE INDEX IF NOT EXISTS datasets_source_idx
  ON datasets (source_id);

CREATE INDEX IF NOT EXISTS datasets_geometry_idx
  ON datasets (has_geometry)
  WHERE has_geometry = true;

CREATE INDEX IF NOT EXISTS datasets_search_idx
  ON datasets
  USING gin (
    to_tsvector(
      'english',
      coalesce(name, '') || ' ' || coalesce(description, '')
    )
  );

-- =========================================================================
-- Sources: ingestion sources we crawl (NYC Open Data, GBFS, MTA, FEMA, ...).
-- =========================================================================
CREATE TABLE IF NOT EXISTS sources (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  agency       text NOT NULL,
  protocol     text NOT NULL,
  endpoint     text NOT NULL,
  homepage     text,
  description  text,
  refresh      text NOT NULL,
  attribution  text NOT NULL,
  license      text
);

-- =========================================================================
-- Themes: 9 top-level groups (Transit, Nature, Buildings, Civic, ...).
-- =========================================================================
CREATE TABLE IF NOT EXISTS themes (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  icon        text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);

-- =========================================================================
-- Categories: the user-facing meta-maps. The application's primitive.
-- =========================================================================
CREATE TABLE IF NOT EXISTS categories (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  theme_id     text NOT NULL REFERENCES themes(id) ON DELETE RESTRICT,
  icon         text NOT NULL,
  description  text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('points', 'lines', 'polygons')),
  cluster      boolean NOT NULL DEFAULT false,
  paint        jsonb NOT NULL,
  popup        jsonb,
  options      jsonb,
  sort_order   int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS categories_theme_idx
  ON categories (theme_id);

-- =========================================================================
-- category_datasets: which underlying source datasets feed each category.
-- A category clubs N datasets into one map; position controls fetch+merge
-- order. spec is the protocol-specific Dataset object as JSONB.
-- =========================================================================
CREATE TABLE IF NOT EXISTS category_datasets (
  category_id  text NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  position     int NOT NULL,
  spec         jsonb NOT NULL,
  PRIMARY KEY (category_id, position)
);

CREATE INDEX IF NOT EXISTS category_datasets_spec_id_idx
  ON category_datasets ((spec->>'id'));
