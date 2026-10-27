# Item detail

`app/items/[category]/[slug]/page.tsx` loads the item and related items.
`index.tsx` renders the shared page shell and selects a media variant using
`contentKind(category.metadataSchemaKey)` from `lib/content-types.ts`.
Category names and URL slugs can change without changing the renderer.

- `variants/image-detail.tsx`: image schemas.
- `variants/music-detail.tsx`: music schemas, with playback handled by `MusicPlayer`.
- `variants/game-detail.tsx`: game schemas.
- `variants/asset-detail.tsx`: asset packs with a separate thumbnail, ZIP download and up to five previews.
- `shared/`: artwork preview, download/save actions, information and related items.

Image and game compose the same `ArtworkDetail` presentation.
Add category-specific presentation in the corresponding variant; keep reusable UI in `shared/`.
The page shell and information render on the server. Browser state stays in the
save button and music player. Keep the media subtree keyed by item ID so navigation
resets playback. Downloads sit beside save in `ItemActions`; multiple files use a
native disclosure menu. Artwork has no action footer or share controls.

Styles remain in `app/items/[category]/[slug]/item-detail.css` and are imported by the route.
