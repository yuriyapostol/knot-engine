import type { MosaicDiagram } from './asset'
import { issue, KNOT_ASSET_LIMITS, standalone } from './validation'
import type { ValidationIssue } from './errors'

// Ports N/E/S/W = 0/1/2/3. Each pair is a separate arc, including crossings.
const arcs: readonly (readonly (readonly number[])[])[] = [
  [], [[3,2]], [[2,1]], [[0,1]], [[0,3]], [[3,1]], [[0,2]],
  [[3,2],[0,1]], [[0,3],[2,1]], [[3,1],[0,2]], [[3,1],[0,2]],
]
export function validateMosaicDiagram(value: unknown, _options: { strict?: boolean } = {}) {
  let counts = { componentCount: 0, occupiedTileCount: 0, crossingCount: 0 }
  const result = standalone<MosaicDiagram>('mosaic', value, diagram => {
    const { tiles } = diagram, n = tiles.length
    const cells = tiles.reduce((sum, row) => sum + row.length, 0)
    if (cells > KNOT_ASSET_LIMITS.mosaicCells) return [issue('tiles', 'Mosaic cell budget exceeded', 'LIMIT_EXCEEDED')]
    if (tiles.some(row => row.length !== n)) return [issue('tiles', 'Expected a square matrix')]
    const issues: ValidationIssue[] = []
    const has = (r: number, c: number, port: number) => arcs[tiles[r][c]].some(pair => pair.includes(port))
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const path = `tiles.${r}.${c}`
      for (const [port, dr, dc] of [[0,-1,0],[1,0,1],[2,1,0],[3,0,-1]]) {
        const rr = r + dr, cc = c + dc
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) {
          if (has(r,c,port)) issues.push(issue(path, 'Port crosses the mosaic boundary'))
        } else if ((port === 1 || port === 2) && has(r,c,port) !== has(rr,cc,(port+2)%4)) issues.push(issue(path, 'Neighbor ports do not match'))
      }
    }
    if (issues.length) return issues
    const visited = new Uint8Array(n*n*4)
    const delta = [[-1,0],[0,1],[1,0],[0,-1]]
    counts = { componentCount: 0, occupiedTileCount: 0, crossingCount: 0 }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const code = tiles[r][c]
      if (code) counts.occupiedTileCount++
      if (code === 9 || code === 10) counts.crossingCount++
      for (const pair of arcs[code]) {
        if (visited[(r*n+c)*4+pair[0]]) continue
        counts.componentCount++
        let rr = r, cc = c, port = pair[0]
        while (!visited[(rr*n+cc)*4+port]) {
          const connection = arcs[tiles[rr][cc]].find(p => p.includes(port))!
          const exit = connection[0] === port ? connection[1] : connection[0]
          visited[(rr*n+cc)*4+port] = visited[(rr*n+cc)*4+exit] = 1
          rr += delta[exit][0]; cc += delta[exit][1]; port = (exit+2)%4
        }
      }
    }
    return counts.componentCount ? [] : [issue('tiles', 'Expected at least one closed component')]
  })
  return result.valid ? { ...result, diagram: result.data, ...counts } : result
}
