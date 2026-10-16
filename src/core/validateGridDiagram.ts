import type { GridDiagram } from './asset'
import { issue, standalone } from './validation'
export function validateGridDiagram(value: unknown, _options: { strict?: boolean } = {}) {
  const result = standalone<GridDiagram>('grid', value, grid => {
    if (grid.encoding === 'vertex-pairs') {
      if (grid.vertices.length !== 2 * grid.size) return [issue('vertices', 'Expected exactly 2 * size vertices')]
      const rows = new Uint16Array(grid.size), columns = new Uint16Array(grid.size)
      for (const [c, r] of grid.vertices) {
        if (c >= grid.size || r >= grid.size) return [issue('vertices', 'Vertex coordinate outside grid')]
        rows[r]++; columns[c]++
      }
      if (rows.some(n => n !== 2) || columns.some(n => n !== 2)) return [issue('vertices', 'Expected exactly two vertices per row and column')]
      return []
    }
    const issues = []
    for (const key of ['x', 'o'] as const) {
      if (grid[key].length !== grid.size || new Set(grid[key]).size !== grid.size || grid[key].some(n => n >= grid.size)) issues.push(issue(key, 'Expected a permutation of row indices'))
    }
    if (grid.x.some((n, i) => grid.o[i] === n)) issues.push(issue('o', 'X and O cannot overlap'))
    return issues
  })
  if (!result.valid) return result
  const { size } = result.data
  let x: number[], o: number[]
  if (result.data.encoding === 'xo') { x = result.data.x; o = result.data.o }
  else {
    // Temporary orientation solely for shared analysis; stored data stays unoriented.
    x = Array(size); o = Array(size)
    const vertices = result.data.vertices
    const rows: number[][] = Array.from({ length: size }, () => [])
    const columns: number[][] = Array.from({ length: size }, () => [])
    vertices.forEach(([c,r], i) => { rows[r].push(i); columns[c].push(i) })
    const seen = new Uint8Array(vertices.length)
    for (let start = 0; start < vertices.length; start++) {
      if (seen[start]) continue
      let current = start
      while (!seen[current]) {
        const [c,r] = vertices[current]; o[c] = r; seen[current] = 1
        const horizontal = rows[r][0] === current ? rows[r][1] : rows[r][0]
        const [xc,xr] = vertices[horizontal]; x[xc] = xr; seen[horizontal] = 1
        current = columns[xc][0] === horizontal ? columns[xc][1] : columns[xc][0]
      }
    }
  }
  const xColumn = new Int32Array(size), oColumn = new Int32Array(size)
  for (let c = 0; c < size; c++) { xColumn[x[c]] = c; oColumn[o[c]] = c }
  // Follow O -> X horizontally, then X -> O vertically.
  const visited = new Uint8Array(size)
  let componentCount = 0, crossingCount = 0
  for (let c = 0; c < size; c++) {
    if (visited[c]) continue
    componentCount++
    let current = c
    while (!visited[current]) { visited[current] = 1; current = xColumn[o[current]] }
  }
  // Strict interior intersections only: marked corners are not crossings.
  for (let row = 0; row < size; row++) {
    const left = Math.min(xColumn[row], oColumn[row]), right = Math.max(xColumn[row], oColumn[row])
    for (let c = left + 1; c < right; c++) {
      if (Math.min(x[c], o[c]) < row && row < Math.max(x[c], o[c])) crossingCount++
    }
  }
  return { ...result, diagram: result.data, componentCount, crossingCount }
}
