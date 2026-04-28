-- Catalog of datasets discovered across all configured sources.
-- One row per (source_id, dataset_id). Refreshed by sync scripts.

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

-- Per-source sync runs, useful for monitoring freshness and debugging.
CREATE TABLE IF NOT EXISTS sync_runs (
  id            bigserial PRIMARY KEY,
  source_id     text NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  inserted      integer NOT NULL DEFAULT 0,
  updated       integer NOT NULL DEFAULT 0,
  error         text
);

CREATE INDEX IF NOT EXISTS sync_runs_source_started_idx
  ON sync_runs (source_id, started_at DESC);
