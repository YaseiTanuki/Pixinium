import type { CatalogDetail, ItemFact } from './entities/catalog'
import { formatDuration } from './media-details'

export function musicFacts(itemId: string, metadata: Record<string, unknown>, media: CatalogDetail['media'], stored: ItemFact[]): ItemFact[] {
  const tracks = media.filter(asset => asset.role === 'download' && asset.mediaType === 'audio')
  const facts: ItemFact[] = []
  const add = (key: string, label: string, value: string) => facts.push({ itemId, key, label, value, sortOrder: facts.length })
  const count = typeof metadata.track_count === 'number' ? metadata.track_count : tracks.length
  if (count > 0) add('tracks', 'Tracks', String(count))
  const duration = typeof metadata.duration_seconds === 'number' ? metadata.duration_seconds
    : tracks.length && tracks.every(track => track.durationSeconds != null)
      ? tracks.reduce((sum, track) => sum + track.durationSeconds!, 0) : null
  const durationLabel = formatDuration(duration)
  if (durationLabel) add('duration', 'Running time', durationLabel)
  const formats = Array.isArray(metadata.formats) ? metadata.formats.filter((format): format is string => typeof format === 'string') : []
  if (formats.length) add('formats', 'Formats', formats.map(format => format.toUpperCase()).join(', '))
  return [...facts, ...stored.filter(fact => !facts.some(generated => generated.key === fact.key))]
}
