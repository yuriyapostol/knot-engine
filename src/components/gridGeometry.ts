import type { GridDiagram, Point2D } from '../core'

export interface GridSegment { start: Point2D; end: Point2D }
export interface GridMarker { kind: 'x' | 'o'; position: Point2D }

/** Validated grid coordinates stay upward-positive; only the SVG group flips Y. */
export function gridGeometry(diagram: GridDiagram) {
  const n = diagram.size
  const rows: number[][] = Array.from({ length: n }, () => [])
  const columns: number[][] = Array.from({ length: n }, () => [])
  const markers: GridMarker[] = []
  function vertex(c: number, r: number) { rows[r].push(c); columns[c].push(r) }
  if (diagram.encoding === 'xo') {
    for (let c = 0; c < n; c++) {
      vertex(c, diagram.x[c]); vertex(c, diagram.o[c])
      markers.push({ kind: 'x', position: [c + 0.5, diagram.x[c] + 0.5] }, { kind: 'o', position: [c + 0.5, diagram.o[c] + 0.5] })
    }
  } else for (const [c, r] of diagram.vertices) vertex(c, r)
  const horizontal: GridSegment[] = [], vertical: GridSegment[] = []
  const inset = diagram.encoding === 'xo' ? 0.2 : 0
  for (let c = 0; c < n; c++) {
    const low = Math.min(...columns[c]), high = Math.max(...columns[c])
    vertical.push({ start: [c + 0.5, low + 0.5 + inset], end: [c + 0.5, high + 0.5 - inset] })
  }
  for (let r = 0; r < n; r++) {
    const left = Math.min(...rows[r]), right = Math.max(...rows[r])
    let start = left + 0.5 + inset
    for (let c = left + 1; c < right; c++) {
      if (Math.min(...columns[c]) < r && r < Math.max(...columns[c])) {
        horizontal.push({ start: [start, r + 0.5], end: [c + 0.5 - 0.16, r + 0.5] })
        start = c + 0.5 + 0.16
      }
    }
    horizontal.push({ start: [start, r + 0.5], end: [right + 0.5 - inset, r + 0.5] })
  }
  return { horizontal, vertical, markers, fit: { center: [n / 2, n / 2] as Point2D, height: n } }
}
