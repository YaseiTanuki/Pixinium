# AI category metadata template

Use this as guidance when generating catalog item drafts. The category's
`metadataSchemaKey` is the contract for the item's `metadata` object. Read the
current category IDs and schema keys from `GET /api/agent/catalog`; do not
hardcode IDs or infer the schema from a category name.

## Shared output shape

```json
{
  "categoryId": "<id-from-catalog>",
  "title": "<short descriptive title>",
  "summary": "<one concise sentence>",
  "description": "<accurate description based on the supplied files and facts>",
  "metadata": {},
  "tags": [],
  "facts": [],
  "attachments": []
}
```

Only include facts supported by the supplied files or source information. Keep
display facts such as platform, version, license, and dimensions in `facts` when
they are not part of the category's machine-readable schema. Never invent
measurements, formats, track counts, or other file properties.

## Category templates

Choose the template that matches the category's `metadataSchemaKey` returned by
the catalog API.

| Category | Schema key | Metadata template | Guidance |
| --- | --- | --- | --- |
| Wallpapers | `images.v1` | `{}` | Original image dimensions and format are detected from the uploaded file. Do not add them to `metadata`. |
| Music | `music.v1` | `{"track_count": 3, "duration_seconds": 245, "formats": ["mp3"]}` | Include only values confirmed by the audio files. All fields are optional; supported formats are `mp3`, `flac`, `wav`, `ogg`, and `aac`. |
| Games | `games.v1` | `{}` | Put known platform and version information in display `facts`. The package size is derived from the download. |
| Assets | `assets.v1` | `{}` on submission | The server calculates and stores `image_count`; do not supply or guess it. Describe the pack using display `facts` as needed. |
| Other categories | `generic.v1` | `{}` | No custom metadata fields are accepted unless the category uses another documented schema. |

The music example is illustrative, not a value to copy. Omit unknown values
rather than using guesses or placeholders. For example, a music submission with
only a confirmed format can use:

```json
{
  "formats": ["flac"]
}
```

## Validation rules

- Metadata must be a JSON object and may contain only fields allowed by its
  schema. Unknown fields are rejected.
- `track_count` must be a positive whole number. `duration_seconds` must be a
  non-negative whole number. Both must be safe integers.
- `formats` must be a non-empty array of supported audio format names.
- Image dimensions, image formats, game package size, and asset-pack image count
  are derived by the server; do not generate those values in metadata.
- A new category without a dedicated schema should use `generic.v1` and an
  empty metadata object.

## Prompt fragment

> Create a catalog draft for the selected category using only the supplied
> source information. Match the category's `metadataSchemaKey` to the metadata
> template above. Return valid JSON in the shared output shape. Do not invent
> file properties; omit unknown optional metadata and use `{}` when the schema
> has no AI-supplied fields. Put supported human-readable details in `facts`.
