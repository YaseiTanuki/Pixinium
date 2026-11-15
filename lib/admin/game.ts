import { fileType } from './content'
import { SWF_MIME } from '../game-swf'

export const PLAYABLE_GAME_TAG = { slug: 'play-able', name: 'play able' } as const
export function hasPlayableGameTag(tags: { slug: string }[]) {
  return tags.some(tag => tag.slug === PLAYABLE_GAME_TAG.slug)
}
export function isPlayableGame(tags: { slug: string }[], media: { role: string; mimeType?: string | null }[]) {
  return hasPlayableGameTag(tags) && media.some(asset => asset.role === 'download' && asset.mimeType === SWF_MIME)
}
export function isGamePackage(path: string) {
  return ['zip', 'swf'].includes(fileType(path)?.extension ?? '')
}

export function validateGameFiles(attachments: { path: string }[], published: boolean) {
  const types = attachments.map(asset => fileType(asset.path))
  if (attachments.some(asset => fileType(asset.path)?.mediaType !== 'image' && !isGamePackage(asset.path))) return 'Games accept one thumbnail image and one ZIP or SWF file.'
  if (types.filter(type => type?.mediaType === 'image').length > 1) return 'Upload only one game thumbnail.'
  if (attachments.filter(asset => isGamePackage(asset.path)).length > 1) return 'Upload only one game package.'
  if (published && !attachments.some(asset => isGamePackage(asset.path))) return 'Upload the game ZIP or SWF file before publishing.'
  if (published && !types.some(type => type?.mediaType === 'image')) return 'Upload a game thumbnail before publishing.'
  return undefined
}
