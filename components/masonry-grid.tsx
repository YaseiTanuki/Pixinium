'use client'

import { Children, useLayoutEffect, useRef, type ReactNode } from 'react'
import { masonryLayout } from '@/lib/masonry-layout'

export function MasonryGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid) return
    const cards = Array.from(grid.children) as HTMLElement[]
    let frame = 0

    function layout() {
      if (!grid || grid.clientWidth === 0) return
      const css = getComputedStyle(grid)
      const gap = parseFloat(css.columnGap) || 0
      const minWidth = parseFloat(css.getPropertyValue('--masonry-column-width')) || 250
      const maxColumns = parseInt(css.getPropertyValue('--masonry-max-columns')) || Infinity
      const columns = Math.max(1, Math.min(maxColumns, Math.floor((grid.clientWidth + gap) / (minWidth + gap))))
      const width = (grid.clientWidth - gap * (columns - 1)) / columns

      // Set every width before measuring, including text wrapping at the new size.
      for (const card of cards) card.style.width = `${width}px`
      const heights = cards.map(card => card.getBoundingClientRect().height)
      const { positions, height } = masonryLayout(heights, columns, gap)
      cards.forEach((card, index) => {
        const { column, top } = positions[index]
        card.style.left = `${column * (width + gap)}px`
        card.style.top = `${top}px`
      })
      grid.style.height = `${height}px`
      grid.dataset.positioned = 'true'
    }

    function scheduleLayout() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(layout)
    }

    layout()
    const observer = new ResizeObserver(scheduleLayout)
    observer.observe(grid)
    // Image loads, font loads and text changes can all change a card's height.
    cards.forEach(card => observer.observe(card))
    window.addEventListener('resize', scheduleLayout)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', scheduleLayout)
      cancelAnimationFrame(frame)
    }
  }, [children])

  return <div ref={ref} className={`masonry-grid ${className}`}>
    {Children.map(children, child => child == null ? null : <div className="masonry-item">{child}</div>)}
  </div>
}
