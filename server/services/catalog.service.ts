import { CONTENT_SCHEMAS } from '../../lib/content-types'
import 'server-only'
import { cache } from 'react'
import { imageFacts } from '../../lib/image-facts'
import { assetFacts } from '../../lib/asset-facts'
import { musicFacts } from '../../lib/music-facts'
import { neon } from '@neondatabase/serverless'
import type { CatalogDetail, Category, Asset, ContentUse, StoryChapter } from '../../lib/entities/catalog'
import { archiveCountQuery, archivePageQuery, cardsQuery } from '../repositories/catalog.queries'
import { CATALOG_DISPLAY } from '../../lib/catalog'

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to load the catalog.')
  return neon(process.env.DATABASE_URL)
}

type Media = CatalogDetail['media'][number] & Pick<Asset, 'provider' | 'externalUrl' | 'bucket' | 'objectPath'>

function assetUrl(asset: Media): string {
  if (asset.provider === 'external' && asset.externalUrl) return asset.externalUrl
  // Resolve only published catalog assets through a fresh, no-store signed redirect.
  if (asset.provider === 's3' && asset.bucket === (process.env.S3_ASSETS_BUCKET || 'assets')) {
    return `/api/assets/${asset.assetId}`
  }
  // Storage origins must be explicitly configured for public catalog media.
  // Private objects require a signed-URL resolver before they can be published.
  const origins: Record<string, string> = JSON.parse(process.env.CATALOG_PUBLIC_ASSET_ORIGINS ?? '{}')
  const origin = origins[`${asset.provider}:${asset.bucket}`]
  if (!origin || !asset.objectPath) throw new Error(`No public asset origin configured for ${asset.provider}:${asset.bucket}`)
  const url = new URL(`${origin.replace(/\/$/, '')}/${asset.objectPath.split('/').map(encodeURIComponent).join('/')}`)
  if (url.protocol !== 'https:') throw new Error('Catalog asset origins must use HTTPS.')
  return url.href
}

export const listCategories = cache(async (): Promise<Category[]> => {
  return await database().query(`SELECT id::text, slug, name, description, icon_key AS "iconKey",
    artwork_style AS "artworkStyle", metadata_schema_key AS "metadataSchemaKey",
    sort_order AS "sortOrder", is_active AS "isActive", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    FROM catalog.categories WHERE is_active ORDER BY sort_order, id`) as Category[]
})

export const listContentUses = cache(async (): Promise<ContentUse[]> =>
  await database().query('SELECT slug, name FROM catalog.content_uses ORDER BY sort_order, slug') as ContentUse[])

export async function listStoryChapters(itemId: string): Promise<StoryChapter[]> {
  const rows = await database().query(`SELECT sc.chapter_number AS "chapterNumber",
      sc.content_markdown AS "contentMarkdown", sc.created_at::text AS "createdAt"
    FROM catalog.story_chapters sc
    JOIN catalog.items i ON i.id = sc.item_id
    JOIN catalog.categories c ON c.id = i.category_id
    WHERE sc.item_id = $1::bigint AND i.status = 'published' AND c.is_active
      AND c.metadata_schema_key = 'stories.v1'
    ORDER BY sc.chapter_number`, [itemId])
  return rows as StoryChapter[]
}

export async function listCatalogItems(filters: { category?: string; slug?: string; query?: string } = {}): Promise<CatalogDetail[]> {
  const rows = await database().query(cardsQuery, [filters.category ?? null, filters.slug ?? null,
    filters.query?.trim() ? `%${filters.query.trim()}%` : null])
  return presentCatalogRows(rows as CatalogRow[])
}

export async function listArchivePage(filters: { category?: string; use?: string; query?: string; page?: number }) {
  const sql = database()
  // Search text is literal, including SQL wildcard characters entered by the user.
  const query = filters.query?.trim().replace(/[\\%_]/g, '\\$&')
  const params = [filters.category || null, null, query ? `%${query}%` : null, filters.use || null]
  const [count] = await sql.query(archiveCountQuery, params)
  const total = Number(count.total)
  const pageSize = CATALOG_DISPLAY.archivePageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const requested = Number.isSafeInteger(filters.page) && filters.page! > 0 ? filters.page! : 1
  const page = Math.min(requested, totalPages)
  const rows = await sql.query(archivePageQuery, [...params, pageSize, (page - 1) * pageSize])
  return { items: presentCatalogRows(rows as CatalogRow[]), total, page, totalPages }
}

type CatalogRow = {
  collect_count: number
  item: CatalogDetail['item']; category: CatalogDetail['category']; assets: Media[]
  facts: CatalogDetail['facts']; metadata_schema_key: string; image_count: number
  music_metadata: Record<string, unknown>
  story_chapter_count: number
  description: string; tags: CatalogDetail['tags']; uses: CatalogDetail['uses']
}

function presentCatalogRows(rows: CatalogRow[]): CatalogDetail[] {
  return rows.map((row) => {
    const assets = row.assets as Media[]
    const media = assets.map(({ provider, externalUrl, bucket, objectPath, ...asset }) => ({
      ...asset, url: assetUrl({ ...asset, provider, externalUrl, bucket, objectPath }),
    }))
    const cover = media.find((asset) => asset.role === 'cover')
    const storedFacts = row.facts as CatalogDetail['facts']
    const facts = row.metadata_schema_key === CONTENT_SCHEMAS.image
      ? imageFacts(row.item.id, media.find(asset => asset.role === 'download' && asset.mediaType === 'image'),
        storedFacts.find(fact => fact.key === 'creator')?.value ?? 'Unknown')
      : row.metadata_schema_key === CONTENT_SCHEMAS.asset
        ? assetFacts(row.item.id, row.image_count,
          media.find(asset => asset.role === 'download')?.mimeType,
          storedFacts.find(fact => fact.key === 'creator')?.value ?? 'Unknown')
        : row.metadata_schema_key === CONTENT_SCHEMAS.music
          ? musicFacts(row.item.id, row.music_metadata, media, storedFacts)
          : storedFacts
    return { item: row.item, collectCount: row.collect_count, chapterCount: row.story_chapter_count,
      category: { ...row.category, metadataSchemaKey: row.metadata_schema_key }, facts, description: row.description,
      tags: row.tags, uses: row.uses, media, cover: cover ? { url: cover.url, altText: cover.altText,
        focalX: cover.focalX, focalY: cover.focalY, width: cover.width, height: cover.height } : null } as CatalogDetail
  })
}

export const getCatalogItem = cache(async (category: string, slug: string) =>
  (await listCatalogItems({ category, slug }))[0] ?? null)
