export const STORAGE_FETCH_BINDING = 'PIXINIUM_STORAGE_TRANSPORT'

/** Capture Workers fetch before OpenNext initializes its global fetch/Request wrappers. */
export function withStorageFetch<T extends {
  fetch(request: Request, env: Record<string, unknown>, ctx: unknown): Promise<Response>
}>(worker: T, nativeFetch: typeof fetch) {
  const transport = { fetch: (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    nativeFetch(input, { ...init, cache: 'no-store', redirect: 'manual' }) }
  return { ...worker, fetch(request: Request, env: Record<string, unknown>, ctx: unknown) {
    return worker.fetch(request, { ...env, [STORAGE_FETCH_BINDING]: transport }, ctx)
  } }
}
