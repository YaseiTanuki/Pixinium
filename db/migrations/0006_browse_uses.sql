INSERT INTO catalog.content_uses(slug, name, sort_order) VALUES
  ('images', 'Images', 0), ('music', 'Music', 4), ('games', 'Games', 5);
UPDATE catalog.content_uses SET sort_order = CASE slug
  WHEN 'wallpaper' THEN 1 WHEN 'background' THEN 2 WHEN 'avatar' THEN 3 END
WHERE slug IN ('wallpaper', 'background', 'avatar');

-- Broad uses coexist with specialized uses on the same item.
INSERT INTO catalog.item_uses(item_id, use_slug)
SELECT i.id, u.slug FROM catalog.items i
JOIN catalog.categories c ON c.id = i.category_id
JOIN catalog.content_uses u ON u.slug = c.slug
WHERE c.slug IN ('images', 'music', 'games')
ON CONFLICT DO NOTHING;
