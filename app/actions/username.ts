'use server'

import { neon } from '@neondatabase/serverless'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getAccount } from '@/server/services/auth.service'
import { usernameSchema, type AuthState } from '@/lib/auth/validation'

export async function chooseUsername(_state: AuthState, form: FormData): Promise<AuthState> {
  const account = await getAccount()
  if (!account) return { error: 'Sign in to choose your username.' }
  if (account.username) return { error: 'Your username is permanent and cannot be changed.' }
  const parsed = usernameSchema.safeParse(form.get('username'))
  if (!parsed.success) return { error: 'Use 3-12 letters, numbers or underscores.' }
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const results = await sql.transaction([
      sql`SELECT set_config('app.user_id', ${account.id}, true)`,
      sql`UPDATE catalog.profiles SET username = ${parsed.data}
          WHERE id = ${account.id}::uuid AND username IS NULL RETURNING username`,
    ])
    if (!results[1].length) return { error: 'Your username has already been set.' }
  } catch (error) {
    return { error: (error as { code?: string }).code === '23505'
      ? 'That username is taken. Choose another.' : 'Could not save your username. Please retry.' }
  }
  revalidatePath('/', 'layout')
  redirect('/profile')
}
