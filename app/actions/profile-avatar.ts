'use server'

import { getAccount } from '@/server/services/auth.service'
import { discardAvatarUploadForActor, prepareAvatarUploadForActor, saveAvatarForActor } from '@/server/services/profile-avatar.service'

export async function prepareAvatarUpload(input: unknown) {
  return prepareAvatarUploadForActor(await getAccount(), input)
}

export async function saveAvatar(input: unknown) {
  return saveAvatarForActor(await getAccount(), input)
}

export async function discardAvatarUpload(input: unknown) {
  await discardAvatarUploadForActor(await getAccount(), input)
}
