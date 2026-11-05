import 'server-only'
import { resolveDownloadSources, type DownloadProvider } from '../../lib/download-sources'
import { listDownloadProviders } from './download-sources.service'
import { cache } from 'react'
import { catalogFacts } from '../../lib/catalog-facts'
import { neon } from '@neondatabase/serverless'
import type { CatalogDetail, Category, Asset, Tag } from '../../lib/entities/catalog'
import { archiveCountQuery, archivePageQuery, archiveTagsQuery, cardsQuery, categoriesQuery } from '../repositories/catalog.queries'
import { CATALOG_DISPLAY } from '../../lib/catalog'
import { searchTags, searchSort, searchCategories } from '../../lib/search-filters'

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to load the catalog.')
  return neon(process.env.DATABASE_URL)
}

type Media = CatalogDetail['media'][number] & Pick<Asset, 'provider' | 'externalUrl' | 'bucket' | 'objectPath'>

function assetUrl(asset: Media): string {
  if (asset.provider === 'external' && asset.externalUrl) return asset.externalUrl
  // Stable application URL; the endpoint checks publication before serving stored bytes.
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

export async function recordItemView(itemId: string) {
  try {
    await database().query("UPDATE catalog.items SET view_count = view_count + 1 WHERE id = $1::bigint AND status = 'published'", [itemId])
  } catch {
    // A failed counter must never break the page.
  }
}

export const listCategories = cache(async (): Promise<Category[]> => {
  return await database().query(categoriesQuery) as Category[]
})

export const listArchiveTags = cache(async (): Promise<Tag[]> => {
  return await database().query(archiveTagsQuery) as Tag[]
})

export async function listCatalogItems(filters: { category?: string; slug?: string; query?: string } = {}): Promise<CatalogDetail[]> {
  const rows = await database().query(cardsQuery, [filters.category ?? null, filters.slug ?? null,
    filters.query?.trim() ? `%${filters.query.trim()}%` : null])
  return presentCatalogRows(rows as CatalogRow[], await listDownloadProviders())
}

export async function listArchivePage(filters: { category?: string; tag?: string; query?: string; page?: number; sort?: string; tagMatch?: string }) {
  const sql = database()
  // Search text is literal, including SQL wildcard characters entered by the user.
  const query = filters.query?.trim().replace(/[\\%_]/g, '\\$&')
  const tags = searchTags(filters.tag ?? '').join(' ')
  const category = searchCategories(filters.category ?? '').join(',')
  const params = [category || null, null, query ? `%${query}%` : null, tags || null, filters.tagMatch === 'any' ? 'any' : 'all']
  const [count] = await sql.query(archiveCountQuery, params)
  const total = Number(count.total)
  const pageSize = CATALOG_DISPLAY.archivePageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const requested = Number.isSafeInteger(filters.page) && filters.page! > 0 ? filters.page! : 1
  const page = Math.min(requested, totalPages)
  const rows = await sql.query(archivePageQuery, [...params, pageSize, (page - 1) * pageSize, searchSort(filters.sort ?? '')])
  return { items: presentCatalogRows(rows as CatalogRow[], await listDownloadProviders()), total, page, totalPages }
}

type CatalogRow = {
  download_sources?: unknown
  collect_count: number; view_count: number; download_count: number
  item: CatalogDetail['item']; category: CatalogDetail['category']; assets: Media[]
  facts: CatalogDetail['facts']; metadata_schema_key: string; image_count: number
  music_metadata: Record<string, unknown>
  description: string; tags: CatalogDetail['tags']
}

function presentCatalogRows(rows: CatalogRow[], providers: DownloadProvider[]): CatalogDetail[] {
  return rows.map((row) => {
    const assets = row.assets as Media[]
    const media = assets.map(({ provider, externalUrl, bucket, objectPath, ...asset }) => ({
      ...asset, url: assetUrl({ ...asset, provider, externalUrl, bucket, objectPath }),
    }))
    const cover = media.find((asset) => asset.role === 'cover')
    const storedFacts = row.facts as CatalogDetail['facts']
    const facts = catalogFacts(row.metadata_schema_key, row.item.id, media, storedFacts)
    return { item: row.item, collectCount: row.collect_count, viewCount: row.view_count, downloadCount: row.download_count, category: { ...row.category, metadataSchemaKey: row.metadata_schema_key }, facts, description: row.description,
      downloadSources: resolveDownloadSources(row.download_sources, providers, media.some(asset => asset.role === 'download')),
      tags: row.tags, media, cover: cover ? { url: cover.url, altText: cover.altText,
        focalX: cover.focalX, focalY: cover.focalY, width: cover.width, height: cover.height } : null } as CatalogDetail
  })
}

export const getCatalogItem = cache(async (category: string, slug: string) =>
  (await listCatalogItems({ category, slug }))[0] ?? null)
