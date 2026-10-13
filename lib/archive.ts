export const stickerSheet = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Exploding%20Werewolf%20Chibi%20Sticker%20Sheet-2yugEHr3cU2GToracMvLHXGFVCDxkt.png'

export const filters = ['All items', 'Wallpapers', 'Music', 'Games']

export const results = [
  { title: 'Exploding Werewolf', category: 'Wallpapers', meta: '4K · 12 images', image: stickerSheet, crop: 'object-[10%_18%]', color: 'bg-[#f1e5dd]' },
  { title: 'Red moon nights', category: 'Wallpapers', meta: '4K · 8 images', image: stickerSheet, crop: 'object-[78%_7%]', color: 'bg-[#2b2226]' },
  { title: 'Velvet After Dark', category: 'Music', meta: '8 tracks · 32 min', color: 'bg-[#241e23]', accent: 'music' },
  { title: 'Mochi Quest', category: 'Games', meta: '326 MB · Windows', image: stickerSheet, crop: 'object-[74%_74%]', color: 'bg-[#e6b8a8]' },
  { title: 'Soft battle themes', category: 'Music', meta: '12 tracks · 48 min', color: 'bg-[#3d2b35]', accent: 'music' },
  { title: 'Cozy pixel café', category: 'Games', meta: '1.2 GB · Windows', image: stickerSheet, crop: 'object-[53%_76%]', color: 'bg-[#edc68c]' },
  { title: 'Night drive radio', category: 'Music', meta: '6 tracks · 24 min', color: 'bg-[#211d20]', accent: 'music' },
  { title: 'Little chaos pack', category: 'Wallpapers', meta: '1080p · 16 images', image: stickerSheet, crop: 'object-[50%_24%]', color: 'bg-[#f3e9e2]' },
]

export type ArchiveItem = typeof results[number]
