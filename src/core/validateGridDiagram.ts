import type { GridDiagram } from './asset'
import { issue, standalone } from './validation'
export function validateGridDiagram(value: unknown, _options: { strict?: boolean } = {}) {
  const result = standalone<GridDiagram>('grid', value, grid => {
    const issues = []
    for (const key of ['x', 'o'] as const) {
      if (grid[key].length !== grid.size || new Set(grid[key]).size !== grid.size || grid[key].some(n => n >= grid.size)) issues.push(issue(key, 'Expected a permutation of row indices'))
    }
    if (grid.x.some((n, i) => grid.o[i] === n)) issues.push(issue('o', 'X and O cannot overlap'))
    return issues
  })
  if (!result.valid) return result
  const { size, x, o } = result.data
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
