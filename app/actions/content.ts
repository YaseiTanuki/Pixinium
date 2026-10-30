'use server'

import { getAccount } from '@/server/services/auth.service'
import { deleteContentForActor } from '@/server/services/content-delete.service'
import { prepareContentUploadForActor, discardContentUploadsForActor, createContentForActor } from '@/server/services/content-upload.service'
import { addStoryChapterForActor } from '@/server/services/story-chapters-write.service'

export async function prepareContentUpload(input: unknown) {
  return prepareContentUploadForActor(await getAccount(), input)
}

export async function discardContentUploads(input: unknown) {
  return discardContentUploadsForActor(await getAccount(), input)
}

export async function createContent(input: unknown) {
  return createContentForActor(await getAccount(), input)
}

export async function addStoryChapter(input: unknown) {
  return addStoryChapterForActor(await getAccount(), input)
}

export async function deleteContent(input: unknown) {
  return deleteContentForActor(await getAccount(), input)
}
