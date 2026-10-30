/** Database bigint IDs are strings at API boundaries; never coerce them to JS numbers. */
export type EntityId = string
/** Supabase auth.users.id. A logical reference across providers, not a Neon FK. */
export type UserId = string
export type Timestamp = string
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }
export type PublicationStatus = 'published' | 'archived'
export type ArtworkStyle = 'image' | 'record'

export interface Category {
  id: EntityId
  slug: string
  name: string
  description: string
  /** Resolve through a frontend icon registry, with a grid fallback. */
  iconKey: string
  artworkStyle: ArtworkStyle
  metadataSchemaKey: string
  sortOrder: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Item {
  id: EntityId
  categoryId: EntityId
  slug: string
  title: string
  summary: string
  description: string
  status: PublicationStatus
  publishedAt: Timestamp | null
  accentColor: string
  isFeatured: boolean
  sortOrder: number
  /** Optional category-specific data. Do not put ownership or asset references here. */
  metadata: JsonObject
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ItemFact {
  itemId: EntityId
  key: string
  label: string
  value: string
  sortOrder: number
}

type AssetLocation =
  | { provider: 'external'; externalUrl: string; bucket: null; objectPath: null }
  | { provider: 'supabase' | 'r2' | 's3'; externalUrl: null; bucket: string; objectPath: string }

export type Asset = AssetLocation & {
  id: EntityId
  mediaType: 'image' | 'audio' | 'video' | 'file'
  mimeType: string | null
  /** bigint bytes, serialized as a decimal string. */
  byteSize: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ItemAsset {
  id: EntityId
  itemId: EntityId
  assetId: EntityId
  role: 'cover' | 'download' | 'preview'
  altText: string
  focalX: number
  focalY: number
  sortOrder: number
}

export interface Tag { id: EntityId; slug: string; name: string }
export interface ItemTag { itemId: EntityId; tagId: EntityId }
export interface ContentUse { slug: string; name: string }
export interface ItemUse { itemId: EntityId; useSlug: string }
export interface StoryChapter {
  chapterNumber: number
  contentMarkdown: string
  createdAt: Timestamp
}

type CollectionOwnership =
  | { kind: 'saved'; ownerUserId: UserId; isPublic: false }
  | { kind: 'custom'; ownerUserId: UserId; isPublic: boolean }
  | { kind: 'editorial'; ownerUserId: null; isPublic: boolean }

export type Collection = CollectionOwnership & {
  id: EntityId
  slug: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CollectionItem {
  collectionId: EntityId
  itemId: EntityId
  addedAt: Timestamp
}

export interface Profile {
  id: UserId
  /** Lowercase, unique; null until onboarding has chosen a username. */
  username: string | null
  displayName: string
  /** Object key in the private `pixinium` bucket, under profile/avatar/. */
  avatarPath: string | null
  role: 'member' | 'editor' | 'admin'
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Presentation contracts: compose entities without exposing persistence details to components. */
export interface CatalogCard {
  /** Aggregate saved collections only; no collector identities are exposed. */
  collectCount?: number
  chapterCount?: number
  item: Pick<Item, 'id' | 'slug' | 'title' | 'summary' | 'accentColor' | 'isFeatured'>
  category: Pick<Category, 'id' | 'slug' | 'name' | 'iconKey' | 'artworkStyle'>
  cover: { url: string; altText: string; focalX: number; focalY: number; width?: number | null; height?: number | null } | null
  facts: ItemFact[]
}

export interface CatalogDetail extends CatalogCard {
  category: CatalogCard['category'] & Pick<Category, 'metadataSchemaKey'>
  uses: ContentUse[]
  description: string
  tags: Tag[]
  /** URLs are resolved per request; signed Supabase URLs must never be persisted. */
  media: Array<ItemAsset & { url: string; mediaType: Asset['mediaType']; width?: number | null; height?: number | null; mimeType?: string | null; byteSize?: string | null; durationSeconds?: number | null }>
}
