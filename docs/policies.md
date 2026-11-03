# Source-managed policies

Policy text lives in `content/policies/*.md`. Titles, navigation labels, release
dates, version and public operator/contact details live in `lib/policies.ts`.
The public routes are `/policies/<slug>`. The source text is rendered into
static pages with shared navigation, section anchors and metadata. Policy
content does not require a database query. Existing site authentication
middleware and header behavior still apply to requests.

The supported Markdown subset is deliberately small: `## Heading`, paragraphs,
`- ` lists, and `[label](url)` links. Separate headings and blocks by blank
lines. Raw HTML renders as text; executable MDX and HTML injection are not
enabled. Link destinations support policy routes, the listed Pixinium email
domain and HTTPS references. Duplicate heading anchors fail the build.

## Operator and mail routing

Operator: Tanuki, Vietnam, as supplied for this implementation. The proposed
role addresses are `support@pixinium.com`, `privacy@pixinium.com` and
`copyright@pixinium.com`. Create these mailboxes or forward all three to a
monitored inbox before relying on the public contact channels. Adding a
`mailto:` link does not provision email. Brevo outbound SMTP does not itself
establish inbound mail routing. No external email configuration was changed.

## Review before deployment

- Confirm Cloudflare and Brevo's actual deployment roles. Their descriptions
  are conditional because dashboard configuration is not established by code.
- Verify provider regions, transfer safeguards and retention settings. The
  privacy text uses retention criteria instead of inventing fixed log or backup
  periods. Maintain an operational record of actual retention schedules.
- Verify Vercel Web Analytics configuration and any consent requirements for
  the markets served. No new analytics, advertisements, affiliate integrations
  or consent controls were added. Do not treat a Cookie Policy link as consent.
- Ensure someone can handle access/deletion requests, account reviews and
  copyright reports received through the public contacts. These pages do not
  create an automated deletion or moderation workflow.
- Review the wording against applicable Vietnamese law and any mandatory
  protections in other markets served. Do not claim a registered statutory
  takedown agent, guaranteed review timeline or compliance certification.

## Updating a policy

Edit its Markdown, review the change, then update the release version and dates
in `lib/policies.ts`. Initial release: version 1.0, effective 3 November 2026.
Keep dates explicit, rather than recalculating them on every build. Git retains
the content history. For a future release, use per-document release metadata if
policies begin following independent release schedules.

If changing the operator or a public email, update both the registry and the
relevant Markdown text. Run `node --import tsx --test tests/policies.test.ts`,
the production build and `node scripts/graphify.mjs update .` after editing.

Terms and Privacy links are shown on registration, including Google signup.
No record of accepted policy versions is written to a database, and no new
claim of stored consent is made. An acceptance audit trail would be a separate
database feature. Asset licenses remain item-specific; no new default license
is applied and the catalog schema is unchanged.

## References used for the draft

- https://www.wipo.int/en/web/copyright/faq-copyright
- https://vercel.com/docs/analytics/privacy-policy
- https://ico.org.uk/for-organisations/advice-for-small-organisations/privacy-notices-and-cookies/cookies-and-privacy-notices-in-detail/
- https://baochinhphu.vn/ke-hoach-trien-khai-thi-hanh-luat-bao-ve-du-lieu-ca-nhan-102251129131617617.htm

The ICO reference explains UK-specific requirements; it is not used as a claim
that UK law applies to every visitor or replaces Vietnamese law.
