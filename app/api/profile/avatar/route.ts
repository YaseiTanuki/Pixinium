import { NextResponse } from 'next/server'
import { getAccount } from '@/server/services/auth.service'
import { signDownload } from '@/server/services/storage.service'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
  try {
    const account = await getAccount()
    if (!account?.avatarPath) return new NextResponse(null, { status: 404, headers })
    const url = await signDownload(account.avatarPath, false)
    return new NextResponse(null, { status: 307, headers: { ...headers, Location: url } })
  } catch {
    return new NextResponse(null, { status: 503, headers })
  }
}
