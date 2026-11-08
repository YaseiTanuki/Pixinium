# Cloudflare Workers with OpenNext

OpenNext builds the existing Next.js application and adapts its server output for
Cloudflare Workers. Local `pnpm dev`, `pnpm build` and `pnpm start` retain the Node.js
workflow. Next.js 16.4.5 meets the adapter's minimum supported patch version.

## Workers Builds settings

Connect the `main` branch and select the directory containing `package.json`.

`main` is the deployment branch and `dev` is the development branch. Create feature
branches from `dev`, merge reviewed changes into `dev`, then release through a PR
from `dev` to `main`. CI checks pushes and PRs targeting either branch. The older
`production` branch is retained as historical release context.

In Cloudflare Workers Builds, set the production branch to `main`. This is a
dashboard setting; changing Git branches or this workflow does not update it.

| Setting | Value |
| --- | --- |
| Worker name | `pixinium` |
| Build command | `pnpm cf:build` |
| Deploy command | `pnpm cf:deploy` |
| Preview builds | Disabled initially |

`cf:build` runs both the Next.js build and the OpenNext conversion. Do not replace
the package's `build` script with this command: OpenNext calls `build` internally.
`cf:deploy` deploys an already built Worker and populates the incremental cache.
For local verification after `cf:build`, run `pnpm cf:preview`.

`cf:upload` uploads a version without promoting it, using the same configured
bindings. It does not isolate production databases or storage. Configure separate
resources and `SEO_NOINDEX=true` before enabling non-production builds.

## Cloudflare resources

The validated Worker bundle is about 15.7 MiB uncompressed / 3.6 MiB compressed.
Since 4 September 2026, Workers Free and Paid both allow 64 MiB uncompressed;
there is no compressed-size limit. This build meets the size limit on Free.
CPU, memory, startup time and service-specific quotas still apply. The dry run
does not activate or purchase a plan.

Before the first deployment, enable R2 and create the `pixinium-next-cache` bucket
in the intended Cloudflare account, for example with
`pnpm exec wrangler r2 bucket create pixinium-next-cache` after authenticating.
This bucket stores Next.js cache entries, separate from the existing private S3
catalog media. Durable Objects for revalidation and cache tags are provisioned by
the migrations in `wrangler.jsonc`.

Enable Cloudflare Images transformations for the `IMAGES` binding. Workers use
this binding to create WebP thumbnails from private bytes; they cannot load the
native `sharp` binary. The Cloudflare build aliases the thumbnail module, while
ordinary Node.js builds continue using `sharp`. Images transformations can incur
Cloudflare usage charges. Originals and generated thumbnails stay in the existing
private S3 storage; no public source URL is required.

## Environment variables

S3 GET/HEAD requests use the SDK's FetchHttpHandler to avoid the Node HTTP
compatibility wrapper for signed reads. Other methods retain the SDK's existing
transport, including streamed ZIP uploads. Traces identify this as `storage.transport`.

Temporary S3 signature diagnostics are enabled by `PIXINIUM_S3_SIGNATURE_DEBUG=true`.
Failed signed GET/HEAD requests emit `storage.signature.debug`: hashes of canonical
requests after signing and before the SDK HTTP handler, per-header hashes, a
credential fingerprint, and local signature verification results. Raw credentials,
Authorization, signed URLs, object keys and provider messages are omitted. This
captures the SDK handler boundary; changes inside the HTTP transport or on the
network require separate verification. Set the variable to `false` after debugging.

Set the public configuration (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) in Workers Builds before building.
Those values are embedded in browser assets and require a rebuild to change.
Set `SEO_NOINDEX=false` only for the canonical production deployment.

Set runtime variables and secrets in **Settings > Variables & Secrets** using
`.env.example` and the local production example as the checklist. In particular,
configure `DATABASE_URL`, `CATALOG_ADMIN_DATABASE_URL`, private S3 credentials,
endpoint, region and bucket. Runtime secrets and build secrets are separate.
Do not add database-owner migration credentials to the Worker. `keep_vars` retains
dashboard-managed ordinary variables across Wrangler deployments.

Local env files can be embedded by OpenNext when building locally. Keep `.env*`
and `.dev.vars*` out of Git, and deploy through clean CI with the intended settings.
The GitHub workflow uses no production credentials, sets noindex, builds on Linux,
validates the Worker bundle, and smoke tests `/robots.txt` in the Workers runtime.
It does not deploy. Windows OpenNext builds may fail creating dependency symlinks;
use Linux/WSL or the workflow for the full packaging check.

Next.js 16 Proxy uses the adapter's experimental Node.js middleware support.
The runtime smoke test covers startup; real login, recovery, uploads and downloads
still need verification with the intended runtime secrets after deployment.

References: [OpenNext setup](https://opennext.js.org/cloudflare/get-started),
[caching](https://opennext.js.org/cloudflare/caching),
[Images binding](https://developers.cloudflare.com/images/optimization/binding/).
See also [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
