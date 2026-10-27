/** Preserve external signed URLs; only our asset route accepts the playback flag. */
export function playbackUrl(url: string): string {
  if (!url.startsWith('/api/assets/')) return url
  const parsed = new URL(url, 'https://local.invalid')
  parsed.searchParams.set('play', '1')
  return `${parsed.pathname}${parsed.search}${parsed.hash}`
}
