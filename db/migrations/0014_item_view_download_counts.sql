-- Aggregate counters only; no visitor identities are stored.
ALTER TABLE catalog.items
  ADD COLUMN view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  ADD COLUMN download_count bigint NOT NULL DEFAULT 0 CHECK (download_count >= 0);
