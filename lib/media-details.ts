/** Database bigint sizes stay strings until formatting, avoiding precision loss. */
export function formatByteSize(value: string | null | undefined): string | null {
  if (value == null || !/^\d+$/.test(value)) return null
  const bytes = BigInt(value)
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB']
  let divisor = BigInt(1)
  let unit = 0
  while (bytes >= divisor * BigInt(1024) && unit < units.length - 1) { divisor *= BigInt(1024); unit++ }
  if (!unit) return `${bytes} B`
  const tenths = (bytes * BigInt(10) + divisor / BigInt(2)) / divisor
  return `${tenths / BigInt(10)}${tenths % BigInt(10) ? `.${tenths % BigInt(10)}` : ''} ${units[unit]}`
}

export function formatDuration(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  const seconds = Math.round(value)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    : `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
