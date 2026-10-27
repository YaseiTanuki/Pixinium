# Asset packs

Asset detail properties are fixed: Quantity (all original pack images), Format
(the ZIP download format), and Creator (using the existing uploader policy).
These values are generated on publication. Preview WebP files do not determine
the download format or total quantity. Up to five preview images appear in a
separate full-width, image-only section below the main detail area.

Choose **Assets** in Admin Studio. Upload one separate thumbnail and 1–11 pack images
(50 MB maximum per file). The first five pack images become the detail-page previews,
in upload order. Remove and re-add an image to change its position.

Publishing validates and decodes every image, creates display-sized WebP previews,
and generates one ZIP containing every original pack image. The separate thumbnail
is excluded from the ZIP. Entry names retain the source basename with a numeric prefix
for uniqueness and path safety. Original bytes are unchanged.

The ZIP is built one image at a time into a temporary file and streamed to object storage.
Only the cover, up to five previews, and the ZIP are persisted. Original staging uploads
are deleted after commit. Temporary ZIP files are removed after processing; failed builds
clean their generated storage objects. Cleanup after a database failure first checks for a
committed reference, because a connection error can hide a successful commit.

## Database

Migration `0011_asset_packs.sql` adds the `preview` attachment role and the Assets
category/use with schema `assets.v1`. Existing item/asset tables already support the
required relationships, ordering and file metadata; no new tables are needed.

- `cover`: separate display thumbnail, served inline.
- `preview`: generated image previews, served inline.
- `download`: one generated ZIP, served as an attachment.
- Item metadata: server-derived `image_count`.

The catalog query, atomic content writer and deletion query handle all three roles.
The asset endpoint checks published status and category visibility before returning
a signed URL. Client requests cannot supply the generated `preview` role.

Migration 0011 was applied to the configured development database on 2026-10-27.
The unrelated pending migration 0010 was left untouched. The live smoke test verified
upload, publication, inline previews, ZIP contents and rendered detail HTML, then
removed its temporary catalog rows and storage objects.

## Agent upload

For `assets.v1`, send one attachment with `role: "cover"` and all pack images with
`role: "download"`. Set `fileName` to the original filename and `altText` to the image
description. The CLI manifest uses the same roles in `files` entries; the CLI supplies
`fileName`. Do not upload a ZIP—the server generates it. Other categories accept
`download` inputs and retain their existing automatic thumbnail behavior.

Limits live in `lib/admin/limits.ts`. ZIP generation follows the
[fflate streaming ZIP API](https://github.com/101arrowz/fflate/blob/master/README.md#zip).
