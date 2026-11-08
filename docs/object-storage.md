# Admin object storage

Supabase remains the identity provider. New uploads use S3-compatible object
storage through `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with
`forcePathStyle: true`. Next.js loads `.env.local`; no dotenv import is needed
inside the application.

Set server-only `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_ENDPOINT_URL_S3`, `AWS_REGION`, and `S3_ASSETS_BUCKET` (default: `assets`).
Keep the bucket private. `CATALOG_ADMIN_DATABASE_URL` must point to the same Neon
database and allow the authenticated admin writer to save catalog rows. Apply
migrations through 0008 to enable S3 assets with original-download and thumbnail roles.

This development workspace uses `S3_ASSETS_BUCKET=pixinium`. Its catalog writer
uses the existing migration connection configured locally; no new DB role was created.

The server checks the current admin role, bucket ACL and bucket policy before issuing a five-minute signed PUT
for a random `staging/<user-id>/<uuid>.<extension>` key. The signature binds the
content type and byte length. The browser uploads directly, with a 50 MiB limit.
Before saving, the server checks ownership, actual size, content type and ETag,
then copies each attachment to a fresh `content/<user-id>/<uuid>.<extension>` key.
Copy preconditions and a post-copy metadata check protect against staging changes.
An old upload URL cannot overwrite a saved object's final key.

Every uploaded file is an original download. The server generates the item's
cover from the first image: a WebP thumbnail up to 800px on its longest side,
quality 80, preserving aspect ratio and avoiding upscaling. Sharp applies EXIF
orientation to the thumbnail and leaves original bytes untouched. Input decoding
is limited to 64 million pixels. Thumbnail dimensions and file size are persisted
separately from the original. Admins no longer choose cover/gallery/preview roles.
For image, music and game items, the stored roles are `cover` (generated display
thumbnail) and `download`. Asset packs also use the `preview` role introduced in
migration 0011. They accept an explicit separate cover and pack images, then store
the cover thumbnail, up to five WebP previews, and a generated ZIP. See [Asset packs](asset-packs.md).
For a multi-file item, the first image supplies its single thumbnail; all originals
remain downloadable. Publishing requires an image; agent submissions remain private drafts until admin review.

Neon stores bucket/object keys, never expiring URLs. `/api/assets/<id>` checks
published status and active category before serving any data. Download originals
stream unchanged; `?view=1` serves image originals inline for detail/SEO without
counting a download. Generated Images thumbnails stream with noindex. Covers and
previews in all categories also stream inline through the same stable API URLs;
the public asset route never redirects to a signed storage URL.
Server-side presigned storage reads use Fetch with `cache: no-store` and reject
redirects. This avoids intermittent signature failures observed with the
Cloudflare Worker cache path and prevents caching private storage responses;
it does not change the browser-facing cache policy below. The Cloudflare build
preserves `no-store` in OpenNext's Fetch and Request wrappers, which otherwise
remove the cache option. The build fails if those wrappers change unexpectedly.
Inline images use `private, no-cache` with ETag/Last-Modified validators. Matching
If-None-Match requests return 304 after rechecking public visibility, without
reading the object body. Shared CDN caching is disabled so archived content is
rejected on the next validation. Downloads, audio and range responses stay no-store.
HEAD returns object headers without reading bytes or incrementing download counts.
Archived items have no public application asset route. Uploaded MIME metadata is not
malware scanning; supported file extensions are defined in `lib/admin/content.ts`.

Configure bucket CORS for the exact production origin before enabling browser uploads.
Verify that anonymous object reads are denied and authenticated uploads succeed.

Removing an attachment or discarding uploads deletes the current admin's staging
objects. Successful saves remove staging only after the database commit. Failed
saves preserve staging for retry. Leaving the form sends a same-origin authenticated
cleanup beacon; browser/network failure can prevent its delivery. Starting another
upload also sweeps up to 1,000 of that admin's staging objects older than 24 hours.
For a full periodic sweep, schedule `node --env-file=.env.local scripts/cleanup-staging.mjs`.
This script only deletes `staging/` objects older than 24 hours. No scheduler is
installed by this change. Final copies from failed DB saves need separate orphan
maintenance; never delete referenced content. Do not assume storage lifecycle
policies execute automatically.

Reference: [Neon S3 compatibility](https://neon.com/docs/storage/s3-compatibility).

## Category storage layout

```text
pixinium/
  image/<item-id>/originals/<file-id>.<ext>
  image/<item-id>/thumbnail.webp
  audio/<item-id>/originals/<file-id>.<ext>
  audio/<item-id>/thumbnail.webp
  game/<item-id>/originals/<file-id>.<ext>
  game/<item-id>/thumbnail.webp
  staging/<admin-id>/<upload-id>.<ext>
  profile/avatar/<user-id>.<ext>
```

Categories `images`, `music`, and `games` map to `image`, `audio`, and `game`.
Future category slugs use their own root. The server reserves an item ID before
copying uploads and commits that same ID with its asset records. Failed saves can
leave harmless sequence gaps. Uses and title-based public URLs do not affect keys.
Only items with an uploaded image have a generated thumbnail.

## Music uploads

Music has separate artwork and audio pickers. One artwork image is accepted;
its staging bytes produce `audio/<item-id>/thumbnail.webp` directly. The artwork
original is never copied into permanent storage or linked as a download.
Successful saves delete its staging object along with staged tracks.

Tracks retain their original bytes under `audio/<item-id>/originals/`.
The server parses audio bytes to detect format and duration, checks the format
against the file extension, and derives track count and total duration. Each
track's duration is also stored on its asset record. Submitted manual music
metadata is ignored. Unsupported or unreadable tracks cannot be saved.
Publishing requires artwork and at least one track. Drafts are not supported.
The implementation uses [music-metadata](https://github.com/Borewit/music-metadata).

Published audio can also play directly on the detail page. The native player uses
`/api/assets/<id>?play=1`, which rechecks public visibility and streams S3 bytes
inline with single-range support for seeking. Artwork and other file types cannot
use this playback mode. Download links stream attachments through the public API.
Players do not preload tracks, and starting one pauses other audio players.
