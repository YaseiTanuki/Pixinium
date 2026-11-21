import { NextResponse } from 'next/server'
import { getAccount } from '@/server/services/auth.service'
import { hasPermission } from '@/lib/auth/permissions'
import { getEditableContentForActor } from '@/server/services/content-edit.service'

/** Private, on-demand content for the admin review queue. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Robots-Tag': 'noindex' }
  try {
    const account = await getAccount()
    if (!account || !hasPermission(account.role, 'admin:access')) return NextResponse.json({ error: 'Admin access required.' }, { status: 403, headers })
    const { id } = await params
    const content = await getEditableContentForActor(account, id)
    if (!content) return NextResponse.json({ error: 'Content not found.' }, { status: 404, headers })
    return NextResponse.json(content, { headers })
  } catch {
    return NextResponse.json({ error: 'Could not load draft. Please retry.' }, { status: 503, headers })
  }
}
