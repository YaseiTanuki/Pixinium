// Stable schema identifiers are the contract with persisted categories.
// Display names and URL slugs remain catalog data, not presentation logic.
export const CONTENT_SCHEMAS = {
  image: 'images.v1',
  music: 'music.v1',
  game: 'games.v1',
  asset: 'assets.v1',
  story: 'stories.v1',
} as const

export type ContentKind = keyof typeof CONTENT_SCHEMAS

export function contentKind(schemaKey?: string): ContentKind {
  return (Object.keys(CONTENT_SCHEMAS) as ContentKind[])
    .find(kind => CONTENT_SCHEMAS[kind] === schemaKey) ?? 'asset'
}
