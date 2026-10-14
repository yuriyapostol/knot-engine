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
  return result.valid ? { ...result, diagram: result.data } : result
}
