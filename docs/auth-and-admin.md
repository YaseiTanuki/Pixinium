# Authentication and admin v1

Routes: `/login`, `/register`, `/auth/confirm`, `/choose-username`, `/profile`, `/admin`.
The header's Account link opens the profile (or redirects guests to login).
Supabase owns passwords and sessions; Neon `catalog.profiles` owns application
roles. The two active roles are `member` (displayed as User) and `admin`.
The existing `editor` value is reserved and receives no admin/upload permission.
Extend `lib/auth/permissions.ts` deliberately when adding roles or permissions.

## Required environment setup

1. Apply the existing catalog migrations through 0003. No new migration is
   required for this change. Configure a restricted Neon runtime credential with
   the grants documented in [entity-model.md](./entity-model.md#hybrid-ownership-and-access).
   Auth operations set `app.user_id` transaction-locally from Supabase's verified
   user, insert missing profiles with role `member`, and select only that UUID.
   Do not use the migration owner as the runtime database login.
2. In Supabase Auth, enable email/password registration and email confirmation.
   Set Site URL to the application's trusted origin. In the Confirm signup email
   template use this link (keep its type fixed):

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
   ```

   Configure SMTP delivery and Auth rate limits for the deployment. The app
   includes a branded confirmation template in `emails/confirm-signup.html`;
   setup instructions are in `emails/README.md`.
   The app relies on provider rate limiting; it does not implement a distributed limiter.
   No client-supplied `next` destination is accepted by the confirmation handler.
3. Configure a private S3-compatible bucket and the server-only AWS settings in
   [object-storage.md](./object-storage.md). Supabase handles authentication only;
   new uploads do not need a Supabase service-role key or Storage bucket.
4. Set `CATALOG_ADMIN_DATABASE_URL` to a dedicated server-only catalog writer on
   the same Neon database as `DATABASE_URL`. The writer needs SELECT on profiles
   and categories (including locks), SELECT/INSERT/UPDATE on tags, INSERT/SELECT
   on items/assets and relationship tables, and USAGE on their identity sequences.
   Existing public-reader RLS policies do not authorize draft access or writes:
   the writer needs explicit restricted policies for its database role, or an
   operator-managed privileged connection. Do not expand the ordinary runtime
   role's permissions. No role credentials or remote grants were provisioned here.

Provider settings, bucket policies and runtime credentials are deployment
prerequisites; their current remote state was not inspected or changed.

## Google sign-in

Both `/login` and `/register` offer **Continue with Google**. The browser starts
Supabase's PKCE flow; `/auth/callback` exchanges the code for session cookies and
redirects to `/choose-username`. Failed or cancelled attempts return to login with
a safe error message. Both Google and email registrations choose their permanent
username on this separate page, using the same illustrated layout as login.
Email registration requires confirmation before this step. Saving a username
opens `/profile`; accounts with a username skip setup automatically. Protected
account pages redirect unfinished accounts to setup. Application roles still
come from the catalog profile.

Before using this flow:

1. Create a Web application OAuth client in Google Auth Platform and configure
   its audience, branding, and email/profile/OpenID scopes. While in testing mode,
   add the Google accounts that will test login.
2. Copy the callback URL shown in Supabase Auth's Google provider settings into
   Google's **Authorized redirect URIs** (normally
   `https://<project-ref>.supabase.co/auth/v1/callback`).
3. Enable Google in Supabase Auth and enter the Google client ID and secret there.
   The secret belongs in Supabase, never in a `NEXT_PUBLIC_` variable.
4. Add `http://localhost:3000/auth/callback` and the deployed site's exact
   `https://<your-domain>/auth/callback` to Supabase Auth's redirect URL allowlist.
   Set Site URL to the deployed site's trusted origin.

Provider configuration is required separately; adding the app code does not
enable the remote provider. Validate successful sign-in, cancellation, expired
codes, profile username setup and sign-out using a configured Google test account.
See the [Supabase Google setup guide](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## Provision the first admin

Register and confirm the intended account, then open `/profile` once. An operator
must verify its UUID in Supabase Auth and promote that exact profile using the
trusted Neon owner connection. For example, with a bound UUID parameter:

```sql
UPDATE catalog.profiles SET role = 'admin' WHERE id = $1::uuid RETURNING id, role;
```

Verify exactly one intended row was returned. Never choose the first signup,
trust a role in user metadata, or expose this SQL as a public action. Demotion uses
the same operator path with `member`; each subsequent upload rereads the role.

## Scope and security boundaries

- `getUser()` resolves identity with Supabase Auth; anonymous and unconfirmed
  accounts cannot access profiles or admin operations.
- The profile's admin link is conditional, `/admin` is guarded on the server, and
  the upload Server Action independently checks `assets:upload` on every call.
- Registration accepts only name/email/password fields. Profile creation never
  updates an existing role. Unknown roles and reserved `editor` fail closed.
- Next.js Server Actions retain same-origin checks and the default small body
  limit. Admins obtain a path-bound signed upload token and transfer file bytes
  directly to Supabase. Limit: 12 attachments per item, 50 MiB per file. The bucket
  must enforce the file limit too: a signed upload token does not enforce the
  browser's declared size. Tokens may remain usable until their provider expiry;
  saving content always rechecks admin permission.
- Uploads use generated paths, reject unsupported filename extensions and never
  overwrite. Finalization verifies path ownership, storage existence, size and
  MIME metadata. This is a trusted-admin workflow, not malware scanning or full
  file decoding. Do not allow ordinary users to obtain upload tokens.
- Studio saves category, title, summary, description, tags, ordered facts,
  category metadata, accent, feature flag, display order and asset relationships.
  Category metadata is validated against the database's schema key. The atomic
  SQL write locks/rechecks the admin role and category, preventing partial saves.
- Drafts are private; publish requires a cover. Public catalog assets use
  `/api/assets/[id]`, which verifies published/active status before issuing a
  no-store signed redirect valid for 60 seconds. Existing signed links remain
  usable until expiry. Download assets use attachment disposition.
- The studio creates new content and lists the 20 most recent items. Admins can
  edit an item at `/admin/[id]/edit`: title, summary, description, uses, tags and
  (for categories whose facts are not generated from files) display facts. The
  update is one transaction that rechecks the admin role. Admins may also replace
  the files: the new files are validated like a new upload and stored under a fresh
  `v-<uuid>` folder, the old assets are unlinked and, if no other item uses them,
  deleted from the catalog; their storage objects are deleted after commit (a failed
  cleanup is reported). Category and URL slug are not editable; profile editing is
  not part of this form.
- Removing an attachment from the form does not delete its storage object. Failed
  or abandoned submissions can leave private orphan uploads. Reconcile paths
  against `catalog.assets` before operator cleanup; never delete by age alone.
- No persistent/shared caching is used for account data. Confirmation responses
  explicitly use private/no-store; proxy refresh preserves SDK cache headers.

## Validation status and next checks

### Diagnosing registration and sign-in failures

`POST /register 200` is the Next.js Server Action response, not proof that Supabase
created an account. Signup and login now log `[auth.signup]` / `[auth.login]` with
the provider code, status, a safe category and elapsed milliseconds. No credentials,
email addresses, raw provider messages or tokens are included. Reproduce once and
use that diagnostic to choose the fix; elapsed time alone is not a diagnosis.

- `email_address_not_authorized`: the default Supabase mail service cannot deliver
  to this recipient; configure custom SMTP for public registration.
- `over_email_send_rate_limit` / HTTP 429: wait, then review provider rate limits.
- Category `email_delivery`: inspect SMTP configuration and Auth/email logs.
- `signup_disabled` / `email_provider_disabled`: review registration/provider settings.
- Category `database`: inspect Supabase Auth triggers and its database logs. Signup
  does not query Neon; moving profile storage cannot fix an Auth insert failure.
- Category `network`: inspect the reported transport code, local DNS/TLS/proxy
  configuration and the Supabase project URL.
- HTTP 401 / invalid API key: verify URL and publishable key belong to the same
  project. Restart Next.js after changing `.env.local`.

With empty Auth logs, check the project/time filters and API gateway logs as well.
Do not disable email confirmation to conceal delivery failures. The absence of
`SUPABASE_SERVICE_ROLE_KEY` affects uploads only, not email signup or login.
See [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) and
[Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).

### Checks

Source-reviewed the identity, role, SQL parameterization, redirect and upload
boundaries. Added `tests/auth-policy.test.ts` covering deny-by-default roles,
injected signup role/ID fields, password handling and file signature rejection.
`git diff --check` passed for tracked changes.

Tests, type checking, builds, browser flows and remote queries were **not run**.
The invoked security-audit skill requires an OS-enforced sandbox with no external
network, an allowlisted empty environment, read-only source/toolchain, scratch-only
writes and resource limits. This session does not supply all those controls.

In an isolated checkout with installed dependencies and dummy credentials, run:

```text
pnpm exec tsc --noEmit
pnpm test:auth
pnpm test:db
pnpm test:content
```

Then validate with an isolated Supabase/Neon fixture: signup and email confirmation;
invalid credentials; expired confirmation; signout; guest redirects; member direct
access to `/admin` and direct upload-action calls; admin upload; demotion followed
by upload denial; database/Auth outages; public-bucket rejection; oversized and
unsupported files; direct Storage API denial for ordinary users. Confirm responses
with auth cookies cannot be cached by the deployment CDN. These are validation
requirements, not claims of executed tests or a completed full security audit.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
