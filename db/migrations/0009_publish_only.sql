-- Uploads are published immediately. Preserve existing content by publishing drafts.
UPDATE catalog.items SET status = 'published', published_at = coalesce(published_at, now()) WHERE status = 'draft';
ALTER TABLE catalog.items DROP CONSTRAINT items_status_check;
ALTER TABLE catalog.items ADD CONSTRAINT items_status_check CHECK (status IN ('published', 'archived'));
ALTER TABLE catalog.items ALTER COLUMN status SET DEFAULT 'published';
ALTER TABLE catalog.items ALTER COLUMN published_at SET DEFAULT now();
