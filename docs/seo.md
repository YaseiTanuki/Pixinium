# SEO configuration

Pixinium's canonical production origin is `https://pixinium.com`. Override it with
`NEXT_PUBLIC_SITE_URL` only when the primary public domain changes. It must contain
an HTTP(S) origin. Configure the hosting provider to redirect alternate domains
(including `www` if used) and HTTP to this primary HTTPS origin.

## Indexing policy

- Home, active category pages, category pagination, and published item pages are
  indexable, with individual canonical URLs.
- Search results and category URLs with search, tag or sorting parameters have
  `noindex, follow`. They are not blocked in robots.txt, so crawlers can read that
  instruction.
- Profile, admin, login and other account pages inherit `noindex, nofollow`.
  Authentication remains the access control for private pages.
- Vercel preview/development deployments are excluded automatically. For other
  staging hosts, set `SEO_NOINDEX=true` before deployment.

`/sitemap.xml` lists only the home page, active categories, and published items
in active categories. It refreshes hourly. Utility, search, filtered, archived,
and private URLs are excluded. The query fetches only slugs and update times,
not media. Split the sitemap before reaching the protocol's 50,000 URL limit.

## Search Console and sharing

1. Deploy to the canonical production domain and verify HTTPS and redirects.
2. Verify the domain through DNS in Google Search Console, or set
   `GOOGLE_SITE_VERIFICATION` to its HTML verification token.
3. Submit `https://pixinium.com/sitemap.xml` in Search Console.
4. Inspect the home page, a category and an item URL; monitor indexing and
   Core Web Vitals with actual production traffic.

Open Graph and Twitter metadata use each item's cover and summary. Pages
without a cover use the branded 1200 × 630 image at `/share-image`.
Structured data describes the website, category/item breadcrumbs and actual
creative works. No pricing, ratings, authorship or licensing claims are added.

Validate representative URLs with Google's Rich Results Test and social sharing
debuggers after deployment. Metadata and structured data improve interpretation
and previews; they do not guarantee ranking or rich results.
