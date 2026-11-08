import openNextWorker from './.open-next/worker.js'
import { withStorageFetch } from './server/services/storage-fetch-binding.ts'

export * from './.open-next/worker.js'
export default withStorageFetch(openNextWorker, globalThis.fetch.bind(globalThis))
