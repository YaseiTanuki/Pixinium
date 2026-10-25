import { fileType } from './content'

export function validateMusicFiles(attachments: { path: string }[], published: boolean) {
  const types = attachments.map(asset => fileType(asset.path)?.mediaType)
  if (types.some(type => type !== 'image' && type !== 'audio')) return 'Music accepts only artwork and audio tracks.'
  if (types.filter(type => type === 'image').length > 1) return 'Upload one artwork image for music.'
  if (published && !types.includes('audio')) return 'Upload an audio track before publishing music.'
  if (published && !types.includes('image')) return 'Upload artwork before publishing music.'
  return undefined
}
