# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Visitors and registered members: create an account, browse images and music/asset content, save items to their account collection, or download them.
- Admins: add, edit and delete content through Admin Studio.

## Product Purpose
A manually curated library that can grow into many content areas (currently images, music, games and asset packs). One item can serve several uses (wallpaper, background, avatar). Success is visitors finding items they want to keep or download, drawn in by a cute, playful interface.

## Positioning
Hand-picked rather than bulk-uploaded content, with an extensible catalog and a playful identity.

## Operating Context
Next.js app. Supabase handles auth; Neon `catalog` schema holds content; private S3-compatible storage holds files. Admins publish through Admin Studio (create, edit, replace files, delete). See `docs/` for details.

## Capabilities and Constraints
- Categories: Images, Music, Games, Asset packs; uses are separate from categories.
- Roles: `member` (User) and `admin`.
- Collections (saving items) and downloads exist for signed-in users.
- Undecided: licensing terms, UI language(s).

## Brand Commitments
- Cozy style; pixel theme preferred where possible (user-stated, binding).
- Cute, fun interface is the main draw.

## Evidence on Hand
Content is the admin-uploaded catalog. No testimonials, usage statistics or press exist; do not invent them.

## Product Principles
- Curation over volume.
- One item, many uses.
- Extensible to new content areas without redesign.
- Admin control over all content.
