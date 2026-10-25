import 'server-only'
import { cache } from 'react'
import { neon } from '@neondatabase/serverless'
import type { CatalogDetail, Category, Asset, ContentUse } from '../../lib/entities/catalog'
import { cardsQuery } from '../repositories/catalog.queries'

function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to load the catalog.')
  return neon(process.env.DATABASE_URL)
}

type Media = CatalogDetail['media'][number] & Pick<Asset, 'provider' | 'externalUrl' | 'bucket' | 'objectPath'>

function assetUrl(asset: Media): string {
  if (asset.provider === 'external' && asset.externalUrl) return asset.externalUrl
  // Resolve only published catalog assets through a fresh, no-store signed redirect.
  if (asset.provider === 'supabase' && asset.bucket === process.env.SUPABASE_ADMIN_UPLOAD_BUCKET) {
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
    accent_color AS "accentColor", artwork_style AS "artworkStyle", metadata_schema_key AS "metadataSchemaKey",
    sort_order AS "sortOrder", is_active AS "isActive", created_at::text AS "createdAt", updated_at::text AS "updatedAt"
    FROM catalog.categories WHERE is_active ORDER BY sort_order, id`) as Category[]
})

export const listContentUses = cache(async (): Promise<ContentUse[]> =>
  await database().query('SELECT slug, name FROM catalog.content_uses ORDER BY sort_order, slug') as ContentUse[])

export async function listCatalogItems(filters: { category?: string; slug?: string; query?: string } = {}): Promise<CatalogDetail[]> {
  const rows = await database().query(cardsQuery, [filters.category ?? null, filters.slug ?? null,
    filters.query?.trim() ? `%${filters.query.trim()}%` : null])
  return rows.map((row) => {
    const assets = row.assets as Media[]
    const media = assets.map(({ provider, externalUrl, bucket, objectPath, ...asset }) => ({
      ...asset, url: assetUrl({ ...asset, provider, externalUrl, bucket, objectPath }),
    }))
    const cover = media.find((asset) => asset.role === 'cover')
    return { item: row.item, category: row.category, facts: row.facts, description: row.description,
      tags: row.tags, uses: row.uses, media, cover: cover ? { url: cover.url, altText: cover.altText,
        focalX: cover.focalX, focalY: cover.focalY } : null } as CatalogDetail
  })
}

export const getCatalogItem = cache(async (category: string, slug: string) =>
  (await listCatalogItems({ category, slug }))[0] ?? null)
