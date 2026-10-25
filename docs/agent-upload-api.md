# Agent upload API

This API lets trusted agents create images, music and games using the same
validation and storage processing as Admin Studio. It grants upload and publish
access on behalf of one existing admin. The current admin role is checked on every
request; content creation also checks it inside the database write.

## Configure

Run from the project directory, substituting the UUID of an existing admin in
`catalog.profiles`:

```sh
node scripts/setup-agent-api.mjs <existing-admin-uuid> http://localhost:3000
```

This creates a random bearer token in gitignored `.env.agent.local` and writes
only its SHA-256 hash and admin ID to `.env.local`. Restart Next.js. For deployment,
configure `AGENT_API_TOKEN_SHA256` and `AGENT_API_ADMIN_ID` in the server environment
and give the agent the token through its secret manager. Use HTTPS outside localhost.
Never expose these settings through `NEXT_PUBLIC_*` or send the token in a URL.

The API stays disabled (503) until configured. Remove the hash to revoke the token,
or change the account's role to revoke admin access. Restart/redeploy after changing
server environment variables. To rotate locally, remove the two server settings
and the old client credentials file, then rerun setup.

## Endpoints

Send `Authorization: Bearer <token>` on every API request. Send
`Content-Type: application/json` for POST and DELETE. JSON bodies are limited to
64 KiB; binaries are uploaded directly to the temporary signed storage URL.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agent/catalog` | Active category IDs, uses, file types and limits |
| POST | `/api/agent/uploads` | Request a temporary upload URL |
| DELETE | `/api/agent/uploads` | Delete an array of owned staging paths |
| POST | `/api/agent/content` | Publish content |

### 1. Prepare and upload each file

POST `/api/agent/uploads`:

```json
{ "name": "sunset.png", "size": 123456 }
```

The 201 response includes `path`, `url`, `method: "PUT"`, `headers` and
`expiresIn: 300`. PUT the exact file bytes to `url` with the returned Content-Type
and the exact Content-Length. Do **not** forward your API bearer token to storage.
Treat signed URLs as secrets. Files are limited to 50 MiB each.

### 2. Create content

Get the actual `categoryId` from `/api/agent/catalog`. POST `/api/agent/content`:

```json
{
  "categoryId": "1",
  "title": "Quiet sunset",
  "status": "published",
  "summary": "A warm sunset for your collection.",
  "uses": ["wallpaper", "background"],
  "attachments": [
    { "path": "<returned-staging-path>", "altText": "An orange sunset over the mountains" }
  ]
}
```

Provide `categoryId`, `title` and the required uploaded files. Omitted optional fields
default to empty descriptions, arrays and metadata, published status, display order 0,
unfeatured and accent `#f1e5dd`. Optional `tags` are `{slug,name}` objects; optional
`facts` are `{key,label,value}` objects. Attachment focalX/focalY default to 50.
Do not submit asset roles, item IDs, slugs, bucket keys or signed URLs as paths.
The server assigns those fields. `altText` is required for image attachments.

- Images: originals remain downloads; the first image generates the thumbnail.
- Music: one artwork image plus audio tracks. Only the thumbnail is retained for
  artwork. Audio duration, count and formats are detected automatically.
- Games: one artwork image plus one ZIP package. Artwork is thumbnail-only.
- Publishing requires artwork; music also requires audio, games require a ZIP.
- Up to 12 staged files per item. Their paths must belong to the configured admin.

Success returns 201 with `id`, `slug`, `category`, `message`, and `href` for a
published item. Saves remove staging objects after the database commit.

Creation is **not idempotent**. After a timeout or lost response, check Admin Studio
before retrying; a save might already have committed. Validation/storage failures
return 422 with `{ "error": "..." }`. Authentication errors use 401/403; malformed
requests use 400/413/415; unavailable configuration uses 503.

### Cancel an upload

DELETE `/api/agent/uploads` with an array of the returned paths. This only deletes
the admin's temporary uploads, never published files. Abandoned staging files are
also handled by the existing staging cleanup workflow.

## Included upload client

Create a manifest next to your files:

```json
{
  "categoryId": "1",
  "title": "Quiet sunset",
  "status": "published",
  "files": [
    { "file": "sunset.png", "altText": "An orange sunset over the mountains" }
  ]
}
```

```sh
node --env-file=.env.agent.local scripts/agent-upload.mjs /path/to/manifest.json
```

The client requests signed URLs, uploads bytes, creates content and prints its
identity. It cleans up failed uploads before submission and never automatically
retries content creation. For music/game manifests, supply artwork and tracks/ZIP
as separate `files` entries; their types determine how they are processed.
