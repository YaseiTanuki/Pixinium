CREATE TABLE catalog.story_chapters (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id bigint NOT NULL REFERENCES catalog.items(id) ON DELETE CASCADE,
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  content_markdown text NOT NULL CHECK (length(btrim(content_markdown)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, chapter_number)
);

INSERT INTO catalog.story_chapters(item_id, chapter_number, content_markdown)
SELECT i.id, 1, i.description
FROM catalog.items i
JOIN catalog.categories c ON c.id = i.category_id
WHERE c.metadata_schema_key = 'stories.v1' AND length(btrim(i.description)) > 0;

UPDATE catalog.items i SET description = ''
FROM catalog.categories c
WHERE c.id = i.category_id AND c.metadata_schema_key = 'stories.v1';

ALTER TABLE catalog.story_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_chapters_read ON catalog.story_chapters FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM catalog.items i
    JOIN catalog.categories c ON c.id = i.category_id
    WHERE i.id = story_chapters.item_id
      AND i.status = 'published'
      AND c.is_active
      AND c.metadata_schema_key = 'stories.v1'
  )
);
REVOKE ALL ON catalog.story_chapters FROM PUBLIC;
