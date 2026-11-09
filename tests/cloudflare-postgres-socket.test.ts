import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import test from 'node:test'

const require = createRequire(import.meta.url)
const requireFromPg = createRequire(require.resolve('pg'))
// Node's default export is intentionally empty; exercise the actual Workers implementation.
const { CloudflareSocket } = require(join(dirname(requireFromPg.resolve('pg-cloudflare/package.json')), 'dist/index.js'))

function pendingSocket() {
  let incoming!: ReadableStreamDefaultController<Uint8Array>
  const readable = new ReadableStream<Uint8Array>({ start(controller) { incoming = controller } })
  const socket = new CloudflareSocket(false)
  socket._cfReader = readable.getReader()
  return { socket, failRead: (error: Error) => incoming.error(error) }
}

test('ending a socket settles its pending read without a second connection error', async () => {
  const { socket, failRead } = pendingSocket()
  socket._cfSocket = { close: async () => failRead(new TypeError('This socket has been closed.')) }
  const reading = socket._listen()
  socket.end()
  await assert.doesNotReject(reading)
})

test('a read rejected after the peer close event does not become an unhandled rejection', async () => {
  const { socket, failRead } = pendingSocket()
  socket._cfSocket = { closed: Promise.resolve() }
  socket._addClosedHandler()
  const closed = new Promise(resolve => socket.once('close', resolve))
  const reading = socket._listen()
  await closed
  failRead(new TypeError('This socket has been closed.'))
  await assert.doesNotReject(reading)
})

test('an active socket still rejects a genuine network read failure', async () => {
  const { socket, failRead } = pendingSocket()
  const networkFailure = new Error('Network connection lost.')
  const rejected = assert.rejects(socket._listen(), error => error === networkFailure)
  failRead(networkFailure)
  await rejected
})
