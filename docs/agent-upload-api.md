# Independent agent upload API

Agents have their own machine identities in `automation.agents`. They are not
Supabase users, Neon profiles or administrators. The human Admin Studio keeps
its existing Supabase authentication. The agent API uses only
`AGENT_DATABASE_URL`, a dedicated login without ownership, BYPASSRLS, role or
database creation privileges. It has EXECUTE access to an allowlist of checked
functions and no direct SELECT/INSERT/UPDATE/DELETE grants on application tables.

Agent uploads are saved as **private drafts awaiting admin review**. They do not
appear in the public archive or public media API until an administrator publishes
them in Admin Studio. Supplying `status: published` cannot bypass review: both
the HTTP handler and the database broker enforce draft status.

## Migration and activation

Test `db/migrations/0019_independent_agents.sql` and `0020_agent_draft_review.sql` on an isolated copy of the
application database first. Production is a separate deployment/cutover choice;
do not assume its schema matches development. Then, from the trusted server
workspace:

```powershell
$env:AGENT_EXPECTED_BRANCH_ID = '<verified-target-branch-id>'
node --env-file=.env.local scripts/migrate-agent-api.mjs
node --env-file=.env.local scripts/setup-agent-api.mjs configure-runtime
node --env-file=.env.local scripts/setup-agent-api.mjs create pixinium-upload-agent --categories images,music,games,assets --url http://localhost:3000
```

The migration script verifies existing local migration checksums and refuses
unrelated pending migrations. Previously applied entries absent from this
checkout are reported and left intact. This change does not repair that separate
history discrepancy. `configure-runtime` creates `pixinium_agent_api`, grants
only the `pixinium_agent` function role and saves `AGENT_DATABASE_URL` to
`.env.local`. It also removes the old admin-bound environment settings. Keep the
generated private recovery/backup environment files secure.

The create command saves the API secret to gitignored `local/pixinium-agent/.env.local`; it
prints only agent/key IDs and scopes. Restart the app after changing its
environment. On a deployed server, configure `AGENT_DATABASE_URL` through its
secret manager. Give the agent only `AGENT_API_URL` and `AGENT_API_TOKEN`, never
database credentials, storage credentials or a Supabase session.

Legacy bearer tokens and `AGENT_API_ADMIN_ID` / `AGENT_API_TOKEN_SHA256` no longer
authenticate. No admin user is created, modified or removed by agent activation.

## Keys and authorization

Keys have the form `pxa_<key-uuid>_<256-bit-random-secret>`. The database stores a
SHA-256 digest of the random secret, not the secret. Each key has independent
scopes, expiry, revocation and last-used timestamps. Account disablement,
category restrictions and key permissions are checked again in database entry
points, including final publication.

| Scope | Operation |
| --- | --- |
| `catalog:read` | Read allowed category IDs, tags and upload rules |
| `uploads:write` | Reserve uploads or discard the agent's unclaimed staging |
| `content:create` + `content:publish` | Submit a new private draft for admin review |

The existing `content:publish` scope name is retained for deployed keys, but it
does not approve public visibility. `automation.publish_job` also retains its
broker signature; its write now always uses `status = draft` and a null
`published_at`. Existing public items and completed historical jobs are not
changed by the migration.

Agent access does not include editing/deleting existing items, reading profiles
or saved collections, changing permissions or accessing the Admin UI. Featured
status and sort order are server-controlled for agent publications. Catalog
categories are restricted to those explicitly assigned to the machine account.

The creation command defaults to all four scopes and a 90-day key. Use
`--scopes catalog:read,uploads:write` or another explicit subset and `--days 30`
where appropriate. An upload-only key cannot publish. At least one allowed
category must be selected when creating the account.

## Rotation and immediate disablement

Run management commands only in the trusted server workspace:

```powershell
node --env-file=.env.local scripts/setup-agent-api.mjs status
node --env-file=.env.local scripts/setup-agent-api.mjs rotate <agent-id> --scopes catalog:read,uploads:write,content:create,content:publish --url https://pixinium.com
node --env-file=.env.local scripts/setup-agent-api.mjs revoke <old-key-id>
node --env-file=.env.local scripts/setup-agent-api.mjs disable <agent-id>
```

Rotation issues another key without automatically revoking the old one, so
clients can switch before revocation. Database revocation/disablement does not
require an app redeploy. Operations already committing can complete while a
revocation waits for their authorization locks. Previously issued storage URLs
remain valid until their short expiry (currently five minutes); revoking a key
does not retroactively revoke those URLs. Publication still rechecks permission.

## Shared quotas and job leases

Defaults per agent account (shared by all of its keys and app instances):

- 60 authenticated API requests per minute.
- 1 GiB of reserved upload bytes per UTC day.
- 100 new publication jobs per UTC day.
- Two concurrently processing jobs, with a ten-minute lease and at most three
  attempts per job. An expired attempt cannot commit after a retry receives a
  new lease token.

Quota reservations are conservative: failed or cancelled uploads do not refund
reserved daily bytes, and failed jobs still count toward the daily job budget.
This avoids using failures/cancellation to bypass limits. Per-file limits are
still 50 MiB; normal content allows 12 files and asset packs up to 51 inputs.
Operators may adjust bounded limits on `automation.agents`. Failed/invalid
credentials still require a database lookup; use deployment-level request/IP
protection for anonymous traffic. Application quotas protect authenticated work,
not every possible source of denial of service.

## API contract

All requests use `Authorization: Bearer <key>`. Send JSON with
`Content-Type: application/json`; JSON is bounded to 64 KiB. Use HTTPS outside
localhost. Never include API keys in URLs or forward them to object storage.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/api/agent/catalog` | Allowed categories, tags, file types and limits |
| POST | `/api/agent/uploads` | Reserve bytes and return a signed PUT URL |
| DELETE | `/api/agent/uploads` | Discard only owned, unclaimed temporary files |
| POST | `/api/agent/content` | Idempotent draft submission using staged files |

Upload JSON is `{ "name": "sunset.png", "size": 12345 }`. PUT the actual bytes
to the returned URL using its supplied headers. Staging paths have the form
`agents/<agent-id>/<upload-id>.<ext>`, distinct from user/admin staging. Final
objects are under `agents/<agent-id>/items/<item-id>/<attempt-lease>/`. A job
claims its upload grants before expensive file processing; another job or agent
cannot claim those files, and active claimed inputs cannot be discarded.

Optional `downloadSources` accepts HTTPS links to configured external sources:
`[{ "provider": "github", "url": "https://github.com/owner/repo" },
{ "provider": "internet_archive", "url": "https://archive.org/details/item" }]`.
Read source IDs, names, exact domains and priorities from `GET /api/agent/catalog`
(`downloadSources`). Administrators manage these at `/admin/download-sources`.
Source definitions and priorities live in `catalog.download_sources`; each item's
URLs live in `catalog.item_download_sources`. The enabled source with the lowest
priority number becomes the main action, including Pixinium's hosted files.
Other sources appear as mirrors. Disabled sources retain their links but are
hidden from visitors. Only enabled external sources accept new links, and URLs
must use the source's configured domain. Omit the field or send an empty array
for hosted-file downloads only. The default source order is GitHub (1), Internet
Archive (2), Pixinium (3); this order is editable in Admin Studio.

For publication, send `Idempotency-Key: <stable-job-key>` and a body such as:

```json
{
  "categoryId": "1",
  "title": "Quiet sunset",
  "metadata": {},
  "tags": [{ "slug": "cozy", "name": "Cozy" }],
  "attachments": [{
    "path": "agents/<agent-id>/<upload-id>.png",
    "altText": "Warm sunset over a quiet landscape",
    "role": "download"
  }]
}
```

Get real category IDs from the catalog endpoint. Original image ratios, file
validation, thumbnail generation, audio metadata and asset-pack generation use
the same processing pipeline as Admin Studio:

- Images: originals are downloads; the first image generates a cover thumbnail.
- Music: one artwork image plus audio tracks; artwork becomes a thumbnail.
- Games: one artwork image and one ZIP package.
- Asset packs: one `cover` image plus up to 50 `download` images. Supply
  `fileName` for original ZIP entry names. Server-generated previews cannot be
  submitted as inputs. See [asset-packs.md](asset-packs.md).

Success is HTTP 201 with the item ID, slug, category, `status: "draft"` and a
review-pending message. No public `href` is returned for a new draft. A completed retry
returns the same stored result with `Idempotency-Replayed: true`. A concurrent
request for a running job returns 202 and `Retry-After: 5`. Reusing the same key
with a different normalized body returns 409. After an interrupted request, retry
the exact body, including the same staging paths, with the same key.

Other responses include 401 (invalid/revoked/expired key), 403 (scope/category/
ownership), 409 (lease or job conflict), 429 (quota), 422 (invalid content), and
503 (runtime not configured or uses an overprivileged role). Provider errors,
secret hashes and storage credentials are not returned to clients.

## Admin review

Admin Studio has separate Drafts and Published views with counts. Search,
category, tags, sort and pagination are URL-persisted and applied before paging.
Filters reset to page 1 and clearing filters retains the current status view.
An administrator can open Review to inspect private media, save text/file edits,
then choose **Publish saved draft**. Only the saved version is approved. Published
items can be moved back to drafts, which removes their public visibility.

The status action verifies the Supabase account and Neon admin role, rechecks
the role inside the SQL write, and requires an active category and cover image.
Existing takedown triggers still block restricted items from publication.
Draft review media uses `/api/admin/assets/:id`, guarded by admin authentication;
`/api/assets/:id` continues to reject drafts for everyone, including guests.

## Resumable command-line client

The standalone client lives in `local/pixinium-agent/`, outside the application
source. Copy that whole folder to the agent machine; it requires only Node.js
22 or later, no frontend dependencies. `local/` is intentionally Git-ignored,
so transfer or back up this folder separately. Its README and manifest example
describe the client contract. The existing API, database brokers and operator
key-management scripts remain server-side.

```powershell
cd local/pixinium-agent
node --env-file=.env.local upload.mjs path/to/manifest.json
```

The manifest contains category/title/metadata plus `files`, each specifying
`file`, optional `role`, and `altText`. Paths are relative to the manifest.
The client retains a private `<manifest>.agent-state.json` checkpoint with the
stable idempotency key and uploaded attachment paths. Rerunning the same command
resumes that job rather than uploading everything again. Changing the manifest
or files requires a new manifest path; do not remove a checkpoint merely to
retry an uncertain publication. Checkpoints do not contain the bearer token or
signed upload URLs. Polling a 202 response retains the same body and key.

## Audit and maintenance

`automation.item_origins` links an item to its agent, key and job. Append-only
runtime audit events record key management, upload reservations, jobs and final
publication without raw tokens or private request bodies. The runtime cannot
edit/delete these records or any existing content. Operators retain separate
database administration privileges.

Retention/cleanup is an operator task: prune old usage buckets and expired,
unclaimed upload-grant records according to operational requirements. Reconcile
failed-attempt storage directories with successful job results before deleting
objects; do not delete every agent object based only on age. Storage credentials
stay in the server-side broker; prefix isolation is enforced there and through
database grants, not by issuing bucket-wide credentials to agent clients.

Validation: in-memory permission/scope/quota/idempotency tests, a real restricted
login on an isolated Neon branch, concurrent authorization, and a synthetic HTTP
upload/publication/replay were checked. Fixture storage objects were removed.
