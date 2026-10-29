import 'server-only'
import { neon } from '@neondatabase/serverless'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type Permission } from '@/lib/auth/permissions'
import { usernameSchema } from '@/lib/auth/validation'
import { authDiagnostic } from '@/lib/auth/errors'

export async function getAccount() {
  const supabase = await createClient()
  // Resolve the identity against Auth, never trust browser user IDs or metadata roles.
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user || data.user.is_anonymous || !data.user.email_confirmed_at) return null
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
  const sql = neon(process.env.DATABASE_URL)
  const name = typeof data.user.user_metadata?.display_name === 'string'
    ? Array.from(data.user.user_metadata.display_name).slice(0, 100).join('') : ''
  const selectedUsername = usernameSchema.safeParse(data.user.user_metadata?.username)
  const username = selectedUsername.success ? selectedUsername.data : null
  const results = await sql.transaction([
    sql`SELECT set_config('app.user_id', ${data.user.id}, true)`,
    sql`INSERT INTO catalog.profiles (id, username, display_name, role)
        VALUES (${data.user.id}::uuid, ${username}, ${name}, 'member') ON CONFLICT DO NOTHING`,
    sql`INSERT INTO catalog.profiles (id, display_name, role)
        VALUES (${data.user.id}::uuid, ${name}, 'member') ON CONFLICT (id) DO NOTHING`,
    sql`SELECT id, username, display_name, avatar_path, role FROM catalog.profiles WHERE id = ${data.user.id}::uuid`,
  ]).catch((error: unknown) => {
    console.error('[auth.profile]', authDiagnostic(error))
    throw new Error('Your profile could not be loaded. Please try again later.')
  })
  const profile = results[3][0]
  if (!profile) throw new Error('Profile could not be loaded.')
  return { id: data.user.id, email: data.user.email ?? '',
    username: typeof profile.username === 'string' ? profile.username : null,
    displayName: String(profile.display_name),
    avatarPath: typeof profile.avatar_path === 'string' ? profile.avatar_path : null,
    role: String(profile.role),
    joinedAt: data.user.created_at }
}

export async function requireAccount(permission?: Permission) {
  const account = await getAccount()
  if (!account) redirect('/login')
  if (!account.username) redirect('/choose-username')
  if (permission && !hasPermission(account.role, permission)) redirect('/profile?access=denied')
  return account
}
