-- Only original downloads and display thumbnails remain as attachment roles.
INSERT INTO catalog.item_assets(item_id, asset_id, role, alt_text, focal_x, focal_y, sort_order)
SELECT item_id, asset_id, 'download', alt_text, focal_x, focal_y, sort_order
FROM catalog.item_assets WHERE role IN ('cover', 'gallery', 'preview')
ON CONFLICT (item_id, asset_id, role) DO NOTHING;
DELETE FROM catalog.item_assets WHERE role IN ('gallery', 'preview');
ALTER TABLE catalog.item_assets DROP CONSTRAINT item_assets_role_check;
ALTER TABLE catalog.item_assets ADD CONSTRAINT item_assets_role_check CHECK (role IN ('cover', 'download'));
