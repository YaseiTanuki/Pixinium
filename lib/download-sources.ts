import { z } from 'zod'

export const sourceSlugSchema = z.string().regex(/^[a-z][a-z0-9_]{0,59}$/)
export const httpsDownloadUrlSchema = z.string().trim().max(2048).url().refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && !/\s/.test(value) } catch { return false }
}, 'Enter an HTTPS URL without credentials or a custom port.').transform(value => new URL(value).href)
export const downloadSourceSchema = z.object({ provider: sourceSlugSchema, url: httpsDownloadUrlSchema })
export const downloadSourcesSchema = z.array(downloadSourceSchema).max(40).refine(
  sources => new Set(sources.map(source => source.provider)).size === sources.length,
  'Use one URL per download source.',
)
export type ExternalDownloadSource = z.infer<typeof downloadSourceSchema>
export type DownloadProvider = { slug: string; name: string; kind: 'internal' | 'external'; hostname: string | null; priority: number; isActive: boolean }
export type DownloadOption = { provider: string; name: string; kind: 'internal' | 'external'; priority: number; url?: string }
export type ManagedDownloadProvider = DownloadProvider & { itemCount: number }

export const providerInputSchema = z.object({
  slug: sourceSlugSchema,
  name: z.string().trim().min(1).max(80),
  hostname: z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$/).nullable(),
  priority: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
}).refine(value => value.slug === 'pixinium' ? value.hostname === null : value.hostname !== null, 'External sources need a domain.')

export function readDownloadSources(input: unknown): ExternalDownloadSource[] {
  if (!Array.isArray(input)) return []
  const sources: ExternalDownloadSource[] = []
  for (const entry of input) {
    const parsed = downloadSourceSchema.safeParse(entry)
    if (parsed.success && !sources.some(source => source.provider === parsed.data.provider)) sources.push(parsed.data)
  }
  return sources
}

export function validateSourceLinks(links: ExternalDownloadSource[], providers: DownloadProvider[], existing: ExternalDownloadSource[] = []) {
  for (const link of links) {
    const provider = providers.find(source => source.slug === link.provider && source.kind === 'external')
    if (!provider) return 'Choose a configured external download source.'
    if (!provider.isActive && !existing.some(source => source.provider === link.provider && source.url === link.url)) return `${provider.name} is disabled.`
    if (new URL(link.url).hostname !== provider.hostname) return `${provider.name} links must use https://${provider.hostname}/.`
  }
  return null
}

export function resolveDownloadSources(input: unknown, providers: DownloadProvider[], hasFiles: boolean): DownloadOption[] {
  const links = readDownloadSources(input)
  return providers.filter(provider => provider.isActive).flatMap(provider => {
    const link = links.find(link => link.provider === provider.slug)
    if (provider.kind === 'internal' ? !hasFiles : !link || new URL(link.url).hostname !== provider.hostname) return []
    return [{ provider: provider.slug, name: provider.name, kind: provider.kind, priority: provider.priority, ...(link ? { url: link.url } : {}) }]
  }).sort((a, b) => a.priority - b.priority || a.provider.localeCompare(b.provider))
}

export function downloadSourcesFromForm(form: FormData): ExternalDownloadSource[] {
  return [...form.entries()].flatMap(([name, value]) => {
    if (!name.startsWith('download_')) return []
    const url = String(value).trim()
    return url ? [{ provider: name.slice('download_'.length), url }] : []
  })
}
