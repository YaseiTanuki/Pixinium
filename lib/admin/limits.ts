// Shared by input validation, upload controls, cleanup and API discovery.
export const CONTENT_LIMITS = {
  files: 12,
  fileMegabytes: 50,
  title: 200,
  summary: 500,
  description: 20_000,
  attachmentLabel: 300,
  facts: 20,
  factKey: 64,
  factLabel: 80,
  factValue: 300,
  sortOrder: 2_147_483_647,
} as const

export const MAX_CONTENT_FILE_BYTES = CONTENT_LIMITS.fileMegabytes * 1024 * 1024

export const ASSET_PACK_LIMITS = {
  images: 50,
  previews: 5,
} as const

export const MAX_ATTACHMENT_COUNT = Math.max(CONTENT_LIMITS.files, ASSET_PACK_LIMITS.images + 1)
