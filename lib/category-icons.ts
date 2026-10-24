import { Gamepad2, Image, LayoutGrid, Music2, Type } from 'lucide-react'

const icons = { image: Image, music: Music2, gamepad: Gamepad2, type: Type, grid: LayoutGrid }

export function categoryIcon(key: string) {
  return icons[key as keyof typeof icons] ?? LayoutGrid
}
