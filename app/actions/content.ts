'use server'

import { getAccount } from '@/server/services/auth.service'
import { prepareContentUploadForActor, discardContentUploadsForActor, createContentForActor } from '@/server/services/content-upload.service'

export async function prepareContentUpload(input: unknown) {
  return prepareContentUploadForActor(await getAccount(), input)
}

export async function discardContentUploads(input: unknown) {
  return discardContentUploadsForActor(await getAccount(), input)
}

export async function createContent(input: unknown) {
  return createContentForActor(await getAccount(), input)
}
