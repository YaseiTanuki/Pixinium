import { fileType } from './content'

export function validateGameFiles(attachments: { path: string }[], published: boolean) {
  const types = attachments.map(asset => fileType(asset.path))
  if (types.some(type => type?.mediaType !== 'image' && type?.extension !== 'zip')) return 'Games accept one thumbnail image and one ZIP package.'
  if (types.filter(type => type?.mediaType === 'image').length > 1) return 'Upload only one game thumbnail.'
  if (types.filter(type => type?.extension === 'zip').length > 1) return 'Upload only one game package.'
  if (published && !types.some(type => type?.extension === 'zip')) return 'Upload the game ZIP package before publishing.'
  if (published && !types.some(type => type?.mediaType === 'image')) return 'Upload a game thumbnail before publishing.'
  return undefined
}
