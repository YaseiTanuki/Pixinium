# Admin object storage

Supabase remains the identity provider. New uploads use S3-compatible object
storage through `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with
`forcePathStyle: true`. Next.js loads `.env.local`; no dotenv import is needed
inside the application.

Set server-only `R2_ENDPOINT_URL`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and
`R2_SECRET_ACCESS_KEY`. Use the account endpoint without a bucket suffix; the SDK
uses region `auto`. Keep both the r2.dev public development URL and public custom
domains disabled. Set `R2_BUCKET_PRIVATE=true` only after checking those settings.
`CATALOG_ADMIN_DATABASE_URL` points to the same Supabase project as `DATABASE_URL`.

R2 does not support the S3 ACL or bucket-policy inspection APIs. Uploads fail
closed until private configuration is explicitly confirmed, then HeadBucket
checks authenticated bucket access. This confirmation is a deployment assertion,
not continuous monitoring of later dashboard changes. The server checks the
current application role before issuing a five-minute signed PUT
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
separately from the original. Ordinary uploads generate their display roles automatically.
For image, music and game items, the stored roles are `cover` (generated display
thumbnail) and `download`. Asset packs also use the `preview` role introduced in
migration 0011. They accept a separate cover, one uploaded ZIP and up to five
explicit preview images. The ZIP is copied unchanged; thumbnail and preview images
are stored separately and never added to the ZIP. See [Asset packs](asset-packs.md).
For a multi-file item, the first image supplies its single thumbnail; all originals
remain downloadable. Publishing requires an image; agent submissions remain private drafts until admin review.

Supabase Postgres stores bucket/object keys, never expiring URLs. `/api/assets/<id>` checks
published status and active category before serving any data. Download originals
stream unchanged; `?view=1` serves image originals inline for detail/SEO without
counting a download. Generated Images thumbnails stream with noindex. Covers and
previews in all categories also stream inline through the same stable API URLs;
the public asset route never redirects to a signed storage URL.
Server-side presigned storage reads use native Workers fetch with `cache: no-store`
and reject redirects, independently of app-level fetch wrappers. This does not
change the browser-facing cache policy below.
Inline images use `private, no-cache` with ETag/Last-Modified validators. Matching
If-None-Match requests return 304 after rechecking public visibility, without
reading the object body. Shared CDN caching is disabled so archived content is
rejected on the next validation. Downloads, audio and range responses stay no-store.
HEAD returns object headers without reading bytes or incrementing download counts.
Archived items have no public application asset route. Uploaded MIME metadata is not
malware scanning; supported file extensions are defined in `lib/admin/content.ts`.

Deleting an item removes its exclusive stored files before committing the database
deletion. The transaction locks the item and its assets while checking shared
references; files shared with another item are retained. If R2 deletion fails, the
request returns an error and keeps the item and asset records for retry. Some files
may already have been removed; retrying deletion of those keys is safe. A database
failure after storage deletion also keeps the records, but cannot restore R2 bytes.
This flow does not sweep files left untracked by earlier uploads or deletions.

Configure bucket CORS for the exact production origin before enabling browser uploads.
Verify that anonymous object reads are denied and authenticated uploads succeed.

### Browser upload CORS

Both profile avatars and admin attachments upload directly to R2 using signed PUT
URLs. In Cloudflare, open **R2 Object Storage > pixinium > Settings > CORS Policy**
and add the rule in [r2-upload-cors.json](r2-upload-cors.json) using the JSON editor.
If the bucket already has rules, append this rule while preserving those rules.
It permits PUT from `https://pixinium.com` with the browser's `Content-Type`
header and exposes `ETag` for attachment verification. Keep public bucket access
disabled; CORS does not replace signed URL authentication.

Allow up to 30 seconds for propagation, then retry from the profile editor to get
a fresh five-minute upload URL. A successful preflight must include
`Access-Control-Allow-Origin: https://pixinium.com` and allow PUT and Content-Type.
A failed preflight can appear as `Failed to fetch` in the uploader. Application
response headers cannot fix CORS on the separate R2 endpoint.

Reference: [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

Removing an attachment or discarding uploads deletes the current admin's staging
objects. Successful saves remove staging only after the database commit. Failed
saves preserve staging for retry. Leaving the form sends a same-origin authenticated
cleanup beacon; browser/network failure can prevent its delivery. Starting another
upload also sweeps up to 1,000 of that admin's staging objects older than 24 hours.
For a full periodic sweep, schedule `node --env-file=.env.local --import tsx scripts/cleanup-staging.mjs`.
This script only deletes `staging/` objects older than 24 hours. No scheduler is
installed by this change. Final copies from failed DB saves need separate orphan
maintenance; never delete referenced content. Do not assume storage lifecycle
policies execute automatically.

Reference: [Cloudflare R2 S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

## Category storage layout

```text
pixinium/
  image/<item-id>/v-<uuid>/originals/<file-id>.<ext>
  image/<item-id>/v-<uuid>/thumbnail.webp
  audio/<item-id>/v-<uuid>/originals/<file-id>.<ext>
  audio/<item-id>/v-<uuid>/thumbnail.webp
  game/<item-id>/v-<uuid>/originals/<file-id>.<ext>
  game/<item-id>/v-<uuid>/thumbnail.webp
  staging/<admin-id>/<upload-id>.<ext>
  staging/agents/<agent-id>/<upload-id>.<ext>
  profile/avatar/<user-id>.<ext>
```

Categories `images`, `music`, and `games` map to `image`, `audio`, and `game`.
Future category slugs use their own root. The server reserves an item ID before
copying uploads and commits that same ID with its asset records. Failed saves can
leave harmless sequence gaps. Uses and title-based public URLs do not affect keys.
Admin and agent uploads share this layout. Each attempt uses a separate version
directory; agent versions are bound to the active job lease. Existing unversioned
admin keys remain readable. Agent attribution is stored in the database.
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
