import { authDiagnostic } from './auth/errors'

export type ContentCreateStage = 'validate' | 'download_providers' | 'category' | 'storage_policy'
  | 'claim_uploads' | 'inspect_uploads' | 'reserve_item' | 'finalize_files' | 'facts' | 'save_item'

const storageErrors = new Set(['AccessDenied', 'Forbidden', 'SignatureDoesNotMatch', 'InvalidAccessKeyId',
  'ExpiredToken', 'InvalidToken', 'RequestTimeTooSkewed', 'AuthorizationHeaderMalformed',
  'NoSuchKey', 'NotFound', 'NoSuchBucket', 'UnknownError'])

/** Only emit known error identifiers; SDK messages and responses may contain secrets. */
export function contentCreateDiagnostic(error: unknown, stage: ContentCreateStage) {
  const diagnostic = authDiagnostic(error)
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const metadata = value.$metadata && typeof value.$metadata === 'object'
    ? value.$metadata as Record<string, unknown> : {}
  const providerError = typeof value.name === 'string' && storageErrors.has(value.name) ? value.name : undefined
  const status = diagnostic.status ?? metadata.httpStatusCode
  const message = typeof value.message === 'string' ? value.message : ''
  const failure = /(?:external module sharp|load the ["']sharp["'] module)/i.test(message)
    ? 'native_image_module' : undefined
  return { event: 'content.create.failed', stage, ...diagnostic,
    status: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined,
    ...(providerError ? { providerError } : {}), ...(failure ? { failure } : {}) }
}
