import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'

export async function GET() {
  const icon = await readFile(join(process.cwd(), 'public/brand/pixinium-apple-icon.png'))
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: '76px 90px', background: '#f8f5f1', color: '#211d20', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}><img src={`data:image/png;base64,${icon.toString('base64')}`} width={96} height={96} alt="" /><span style={{ fontSize: 68, fontWeight: 700 }}>pixinium<span style={{ color: '#ac343f' }}>.</span></span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}><div style={{ fontSize: 64, fontWeight: 700 }}>Your little archive.</div><div style={{ fontSize: 30, color: '#76645a' }}>Wallpapers · Music · Games · Creative assets</div></div>
      <div style={{ display: 'flex', fontSize: 24, color: '#a8323c' }}>pixinium.com</div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
