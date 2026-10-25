import { parseBuffer } from 'music-metadata'

export async function readAudioMetadata(bytes: Uint8Array, extension: string) {
  const { format } = await parseBuffer(bytes, undefined, { duration: true, skipCovers: true })
  const container = format.container?.toLowerCase() ?? ''
  const codec = format.codec?.toLowerCase() ?? ''
  const detected = container.includes('wave') ? 'wav' : container.includes('flac') ? 'flac'
    : container.includes('ogg') ? 'ogg' : container.includes('adts') || codec.includes('aac') ? 'aac'
    : container.includes('mpeg') && codec.includes('layer 3') ? 'mp3' : undefined
  if (!detected || detected !== extension || !format.sampleRate || !format.numberOfChannels) {
    throw new Error('The track is not valid audio in its selected format.')
  }
  const duration = format.duration
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) throw new Error('Could not determine track duration.')
  return { format: detected, durationSeconds: duration }
}
