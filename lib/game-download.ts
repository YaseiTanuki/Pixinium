import { Zip, ZipPassThrough } from 'fflate'

/** Wrap the original SWF as it is read; no stored ZIP or complete-file buffer is needed. */
export function gameDownloadZip(source: ReadableStream<Uint8Array>, fileName: string) {
  if (!/^game-[1-9][0-9]*\.swf$/.test(fileName)) throw new Error('Invalid game download filename.')
  const reader = source.getReader()
  let cancelled = false
  let zip: Zip
  const entry = new ZipPassThrough(fileName)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((error, chunk, final) => {
        if (error) throw error
        if (cancelled) return
        controller.enqueue(chunk)
        if (final) controller.close()
      })
      zip.add(entry)
    },
    async pull(controller) {
      try {
        const result = await reader.read()
        if (cancelled) return
        if (result.done) {
          entry.push(new Uint8Array(), true)
          zip.end()
          reader.releaseLock()
        } else entry.push(result.value)
      } catch (error) {
        controller.error(error)
        await reader.cancel(error).catch(() => {})
      }
    },
    async cancel(reason) {
      cancelled = true
      await reader.cancel(reason)
    },
  })
}
