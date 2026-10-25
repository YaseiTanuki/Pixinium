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
Only `cover` (generated display thumbnail) and `download` remain in the database.
For a multi-file item, the first image supplies its single thumbnail; all originals
remain downloadable. Drafts can be saved without an image; publishing requires one.

Migration 0008 preserves former covers/gallery/previews as download links. Run
`node --env-file=.env.local --import tsx scripts/backfill-image-thumbnails.ts`
to replace existing S3 full-size covers with generated thumbnails. This does not
fetch or rewrite externally hosted images. The development migration and S3
backfill ran on 2026-10-25; there were no existing S3 covers to convert.

Neon stores bucket/object keys, never expiring URLs. `/api/assets/<id>` checks
published status and active category before redirecting to a 60-second signed GET.
Drafts have no public application asset route. Uploaded MIME metadata is not
malware scanning; supported file extensions are defined in `lib/admin/content.ts`.

The smoke test creates two uniquely named temporary objects and removes them:

```powershell
node --env-file=.env.local scripts/check-object-storage.mjs --configure-cors
```

It verifies bucket privacy, browser preflight, a signed PUT, metadata, copy,
signed GET, and denial of anonymous object access. By default it adds a CORS rule
for `http://localhost:3000`, preserving other rules. Set `STORAGE_CHECK_ORIGIN`
to the exact deployed origin when configuring another environment. Credentials
and signed URLs are never printed. Restart the dev server after changing env vars.

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
```

Categories `images`, `music`, and `games` map to `image`, `audio`, and `game`.
Future category slugs use their own root. The server reserves an item ID before
copying uploads and commits that same ID with its asset records. Failed saves can
leave harmless sequence gaps. Uses and title-based public URLs do not affect keys.
Only items with an uploaded image have a generated thumbnail.

Preview existing S3 paths with:
`node --env-file=.env.local --import tsx scripts/migrate-storage-layout.ts`.
Add `--apply` to copy and verify ETag, length and content type, update each
attachment atomically, then remove unreferenced legacy `content/` objects.
Run while catalog writes are paused. Shared source assets are copied per item;
external assets and staging uploads are untouched. Reruns skip migrated links.
No table alteration is required.
