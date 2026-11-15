# Asset packs

Choose **Assets** in Admin Studio. Upload exactly one ZIP package, one separate
thumbnail, and optionally up to five images in **Preview images**. Every file may
be up to 50 MB. The same controls are used when replacing an existing pack's files.

The uploaded ZIP is the download. Its bytes, filenames and folder structure remain
unchanged; the server does not extract, rebuild or add images to it. Assets inside
the ZIP may include any file types. Thumbnail and preview uploads are display-only.
Only explicit preview inputs appear in the full-width preview section; a pack with
no preview inputs has no preview section.

The server generates WebP display images for the cover and previews and copies the
validated staged ZIP into the item's version directory. All finalized paths are
tracked for cleanup on failure. Original staging uploads are deleted after commit.
Existing saved packs remain readable until their files are replaced.

## Database

The existing `assets.v1` category and item/asset tables support this workflow;
no migration is required.

- `cover`: one generated display thumbnail, served inline.
- `preview`: up to five generated display images, served inline.
- `download`: the uploaded ZIP, served unchanged as an attachment.
- Item metadata is `{}`. The server does not derive a pack quantity from preview
  uploads or ZIP contents.

## Agent upload

Send `metadata: {}` with one image attachment using `role: "cover"`, one ZIP using
`role: "download"`, and optional image attachments using `role: "preview"`.
Provide `altText` for images and a download label for the ZIP. CLI manifests use
these roles in `files` entries. Preview images are never included in the ZIP.
Other categories keep their existing upload contracts.

Limits live in `lib/admin/limits.ts`. Public asset responses recheck publication
and active-category status before serving either display images or downloads.
