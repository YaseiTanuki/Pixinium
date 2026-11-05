import type { DownloadProvider, ExternalDownloadSource } from '@/lib/download-sources'

export function DownloadSourceFields({ providers, sources = [] }: { providers: DownloadProvider[]; sources?: ExternalDownloadSource[] }) {
  const external = providers.filter(provider => provider.kind === 'external' && (provider.isActive || sources.some(source => source.provider === provider.slug)))
  return <section className="workspace-panel">
    <h2>Download links</h2>
    <p className="workspace-muted">Add optional links for this item. The enabled source with the lowest priority number becomes the main download; others appear as mirrors.</p>
    <div className="studio-grid">
      {external.map(provider => <label key={provider.slug}>{provider.name}{!provider.isActive && ' (disabled)'}
        <input className="account-input" type="url" name={`download_${provider.slug}`} maxLength={2048} placeholder={`https://${provider.hostname}/...`} defaultValue={sources.find(source => source.provider === provider.slug)?.url ?? ''} />
        <span className="account-help">{provider.hostname} · Priority {provider.priority}{!provider.isActive && ' · Existing link is kept but hidden from visitors.'}</span>
      </label>)}
    </div>
    {!external.length && <p className="account-help">No external sources are enabled. Manage sources in Admin Studio to add one.</p>}
  </section>
}
