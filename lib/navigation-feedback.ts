export type NavigationFeedback = 'skeleton' | 'list-skeleton' | 'pagination-skeleton' | 'none'

export function navigationFeedback(from: string, to: string): NavigationFeedback {
  const current = new URL(from)
  const next = new URL(to, current)
  if (current.origin !== next.origin) return 'none'
  if (current.pathname !== next.pathname) return 'skeleton'
  if (current.search === next.search) return 'none'

  const currentPage = current.searchParams.get('page') ?? '1'
  const nextPage = next.searchParams.get('page') ?? '1'
  current.searchParams.delete('page')
  next.searchParams.delete('page')
  current.searchParams.sort()
  next.searchParams.sort()
  const onlyPageChanged = current.searchParams.toString() === next.searchParams.toString()
  if (onlyPageChanged && currentPage === nextPage) return 'none'
  if (onlyPageChanged && /^[1-9]\d*$/.test(currentPage) && /^[1-9]\d*$/.test(nextPage)) return 'pagination-skeleton'
  return 'list-skeleton'
}
