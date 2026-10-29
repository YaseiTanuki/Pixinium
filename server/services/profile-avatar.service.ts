import 'server-only'

import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { authDiagnostic } from '@/lib/auth/errors'
import { deleteAvatar, inspectAvatarUpload, signAvatarUpload } from '@/server/services/storage.service'

const AVATAR_LIMIT_BYTES = 2 * 1024 * 1024
const avatarTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

const uploadSchema = z.object({
  type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().positive().max(AVATAR_LIMIT_BYTES),
})

const saveSchema = z.object({
  path: z.string().regex(/^profile\/avatar\/[0-9a-f-]+\.(jpg|png|webp)$/),
})

export type ProfileAvatarActor = { id: string } | null
export type AvatarResult = { error?: string; message?: string; path?: string; url?: string; mime?: string }

function ownsPath(accountId: string, path: string) {
  return path.startsWith(`profile/avatar/${accountId}-`)
}

export async function prepareAvatarUploadForActor(account: ProfileAvatarActor, input: unknown): Promise<AvatarResult> {
  if (!account) return { error: 'Sign in to update your avatar.' }
  const parsed = uploadSchema.safeParse(input)
  if (!parsed.success) return { error: 'Choose a JPG, PNG or WebP image up to 2 MB.' }
  try {
    const extension = avatarTypes[parsed.data.type]
    const path = `profile/avatar/${account.id}-${randomUUID()}.${extension}`
    const { url } = await signAvatarUpload(path, parsed.data.type, parsed.data.size)
    return { path, url, mime: parsed.data.type }
  } catch (error) {
    console.error('[profile.avatar.prepare]', authDiagnostic(error))
    return { error: 'Avatar storage is unavailable. Please try again.' }
  }
}

export async function saveAvatarForActor(account: ProfileAvatarActor, input: unknown): Promise<AvatarResult> {
  if (!account) return { error: 'Sign in to update your avatar.' }
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success || !ownsPath(account.id, parsed.data.path)) return { error: 'Invalid avatar upload.' }
  const path = parsed.data.path
  const extension = path.split('.').at(-1) as 'jpg' | 'png' | 'webp'
  const mime = Object.entries(avatarTypes).find(([, value]) => value === extension)?.[0]
  if (!mime) return { error: 'Invalid avatar image.' }
  try {
    const uploaded = await inspectAvatarUpload(path)
    if (!uploaded.ContentLength || uploaded.ContentLength > AVATAR_LIMIT_BYTES || uploaded.ContentType !== mime) {
      return { error: 'The uploaded image is invalid. Please choose another image.' }
    }
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
    const sql = neon(process.env.DATABASE_URL)
    const results = await sql.transaction([
      sql`SELECT set_config('app.user_id', ${account.id}, true)`,
      sql`SELECT avatar_path FROM catalog.profiles WHERE id = ${account.id}::uuid FOR UPDATE`,
      sql`UPDATE catalog.profiles SET avatar_path = ${path} WHERE id = ${account.id}::uuid RETURNING id`,
    ])
    if (!results[2].length) return { error: 'Your profile could not be updated. Please retry.' }
    const oldPath = typeof results[1][0]?.avatar_path === 'string' ? results[1][0].avatar_path : null
    if (oldPath && oldPath !== path) {
      try { await deleteAvatar(oldPath) }
      catch (error) { console.error('[profile.avatar.cleanup]', authDiagnostic(error)) }
    }
    revalidatePath('/profile')
    return { message: 'Avatar updated.' }
  } catch (error) {
    console.error('[profile.avatar.save]', authDiagnostic(error))
    return { error: 'Could not save your avatar. Please try again.' }
  }
}

export async function discardAvatarUploadForActor(account: ProfileAvatarActor, input: unknown) {
  const parsed = saveSchema.safeParse(input)
  if (!account || !parsed.success || !ownsPath(account.id, parsed.data.path)) return
  try { await deleteAvatar(parsed.data.path) }
  catch (error) { console.error('[profile.avatar.discard]', authDiagnostic(error)) }
}
