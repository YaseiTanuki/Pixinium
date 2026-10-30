// One statement: an item and all its relationships are committed or rolled back together.
export const createContentQuery = `
WITH actor AS MATERIALIZED (
  SELECT id FROM catalog.profiles WHERE id = $1::uuid AND role = 'admin' FOR SHARE
), category AS MATERIALIZED (
  SELECT id, slug, metadata_schema_key FROM catalog.categories
  WHERE id = $2::bigint AND is_active AND metadata_schema_key = $3 FOR SHARE
), input AS (SELECT $4::jsonb AS doc), item AS (
  INSERT INTO catalog.items(id, category_id, slug, title, summary, description, status,
    published_at, accent_color, is_featured, sort_order, metadata)
  OVERRIDING SYSTEM VALUE
  SELECT coalesce((doc->>'reservedItemId')::bigint, nextval(pg_get_serial_sequence('catalog.items', 'id'))),
    c.id, doc->>'slug', doc->>'title', doc->>'summary',
    coalesce(nullif(doc->>'description', doc->>'summary'), ''), doc->>'status',
    CASE WHEN doc->>'status' = 'published' THEN now() ELSE NULL END,
    doc->>'accentColor', (doc->>'isFeatured')::boolean, (doc->>'sortOrder')::integer, doc->'metadata'
  FROM input CROSS JOIN category c CROSS JOIN actor RETURNING id, slug
), story_chapter AS (
  INSERT INTO catalog.story_chapters(item_id, chapter_number, content_markdown)
  SELECT item.id, (doc->'initialChapter'->>'chapterNumber')::integer,
    doc->'initialChapter'->>'contentMarkdown'
  FROM item CROSS JOIN input CROSS JOIN category c
  WHERE c.metadata_schema_key = 'stories.v1' AND doc ? 'initialChapter'
), uses AS (
  INSERT INTO catalog.item_uses(item_id, use_slug)
  SELECT item.id, u FROM item CROSS JOIN input
  CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(doc->'uses', '[]'::jsonb)) AS selected(u)
  UNION
  SELECT item.id, u.slug FROM item CROSS JOIN category c
  JOIN catalog.content_uses u ON u.slug = c.slug
), facts AS (
  INSERT INTO catalog.item_facts(item_id, key, label, value, sort_order)
  SELECT item.id, f->>'key', f->>'label', f->>'value', (ord-1)::integer
  FROM item CROSS JOIN input CROSS JOIN LATERAL jsonb_array_elements(doc->'facts') WITH ORDINALITY AS entries(f,ord)
), tags AS (
  INSERT INTO catalog.tags(slug,name)
  SELECT t->>'slug', t->>'name' FROM item CROSS JOIN input CROSS JOIN LATERAL jsonb_array_elements(doc->'tags') t
  ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id
), links AS (
  INSERT INTO catalog.item_tags(item_id,tag_id) SELECT item.id,tags.id FROM item CROSS JOIN tags
), assets AS (
  INSERT INTO catalog.assets(provider,bucket,object_path,media_type,mime_type,byte_size,width,height,duration_seconds)
  SELECT 's3', $5, a->>'path', a->>'mediaType', a->>'mime', (a->>'byteSize')::bigint,
    (a->>'width')::integer, (a->>'height')::integer, (a->>'durationSeconds')::numeric
  FROM item CROSS JOIN input CROSS JOIN LATERAL jsonb_array_elements(doc->'attachments') a
  RETURNING id,object_path
), attachments AS (
  INSERT INTO catalog.item_assets(item_id,asset_id,role,alt_text,focal_x,focal_y,sort_order)
  SELECT item.id, assets.id, a->>'role', a->>'altText', (a->>'focalX')::numeric,
    (a->>'focalY')::numeric, (ord-1)::integer
  FROM item CROSS JOIN input CROSS JOIN LATERAL jsonb_array_elements(doc->'attachments') WITH ORDINALITY AS entries(a,ord)
  JOIN assets ON assets.object_path = a->>'path'
)
SELECT item.id::text, item.slug, category.slug AS category FROM item CROSS JOIN category`
