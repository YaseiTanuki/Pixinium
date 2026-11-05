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

`/sitemap.xml` lists the home page, public policies, active categories, and published items
in active categories. It refreshes hourly. Utility, search, filtered, archived,
and private URLs are excluded. Item entries include original downloadable image
URLs in the image sitemap. For other categories without an image download, their
representative cover is included instead. Generated Images thumbnails are excluded.
Item `lastmod` is omitted because the current database `updated_at` also changes
on view/download counters, not just content edits. Policy dates use valid date-only
values. The query fetches only slugs and image URLs. Split the sitemap before reaching
the protocol's 50,000 URL limit.

## Search Console and sharing

1. Deploy to the canonical production domain and verify HTTPS and redirects.
2. Verify the domain through DNS in Google Search Console, or set
   `GOOGLE_SITE_VERIFICATION` to its HTML verification token.
3. Submit `https://pixinium.com/sitemap.xml` in Search Console.
4. Inspect the home page, a category and an item URL; monitor indexing and
   Core Web Vitals with actual production traffic.

Open Graph, Twitter and structured data prefer the first original downloadable
image, including its real dimensions and alt text. Images items do not substitute
a low-resolution cover when an original is unavailable. Other content types
without image downloads can still use their artwork; pages without an available
image use the branded 1200 x 630 image at `/share-image`.
Structured data describes the website, category/item breadcrumbs and actual
creative works. No pricing, ratings, authorship or licensing claims are added.

Validate representative URLs with Google's Rich Results Test and social sharing
debuggers after deployment. Metadata and structured data improve interpretation
and previews; they do not guarantee ranking or rich results.

## Full-resolution Images policy

Images detail pages embed the actual original in an HTML img using the same URL
as SEO metadata: `/api/assets/<original-id>?view=1`. The endpoint streams the
unchanged stored bytes inline, without image resizing, a signed redirect or a
download-counter increment. Ordinary download links remain attachments and count
as downloads. Range requests remain supported. Both modes recheck published item
and active category before serving any bytes.

Original image responses are indexable. Generated Images thumbnails are streamed
with `X-Robots-Tag: noindex` on the actual binary response, instead of relying on
a header on a redirect. They remain available for fast catalog cards. Public page
metadata allows `max-image-preview:large`; private and preview deployment indexing
restrictions remain effective. No User-Agent-specific image substitution is used.

All stored public cover/preview images, including Music, Games and Assets, now
stream through stable Pixinium URLs instead of expiring signed redirects. Inline
images return ETag and Last-Modified validators with `private, no-cache`; unchanged
images can be reused with a 304 after public-status validation. This saves body
transfer on repeat views without letting a shared CDN cache bypass takedowns.
HEAD fetches metadata only, and playback/download/range semantics remain unchanged.

The SEO image URLs are stable application URLs; expiring storage signatures are
never emitted in metadata or sitemap entries. Existing indexed thumbnails can
remain visible until crawlers revisit them. Search Console inspection and sitemap
resubmission are deployment follow-up steps, not actions performed by this code.

Reference: https://developers.google.com/search/docs/appearance/google-images
