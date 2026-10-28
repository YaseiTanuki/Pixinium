export function masonryLayout(heights: number[], columns: number, gap: number) {
  const bottoms = Array<number>(Math.max(1, Math.floor(columns))).fill(0)
  const positions = heights.map(height => {
    // Equal-height columns are filled from left to right.
    const column = bottoms.indexOf(Math.min(...bottoms))
    const top = bottoms[column]
    bottoms[column] += height + gap
    return { column, top }
  })
  return { positions, height: Math.max(0, ...bottoms) - (heights.length ? gap : 0) }
}
