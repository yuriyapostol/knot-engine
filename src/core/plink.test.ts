import { describe, expect, it } from 'vitest'
import { importPLink2D, parsePLinkProjection } from './plink'

const ordinary = `% Link Projection
1
0 0
2
0 0
10 10
1
0 1
0
-1`

describe('parsePLinkProjection', () => {
  it('parses an ordinary projection', () => {
    expect(parsePLinkProjection(ordinary)).toEqual({
      virtual: false, components: [{ first: 0, last: 0 }],
      vertices: [[0, 0], [10, 10]], edges: [[0, 1]],
      crossings: [], activeVertex: null,
    })
  })

  it('preserves real and virtual crossings', () => {
    const source = `% Virtual Link Projection
1
0 0
4
0 0
10 10
0 10
10 0
2
0 1
2 3
2
r 0 1
v 0 1
-1`
    expect(parsePLinkProjection(source).crossings).toEqual([
      { type: 'classical', underEdge: 0, overEdge: 1 },
      { type: 'virtual', underEdge: 0, overEdge: 1 },
    ])
  })

  it('imports classical crossings as ordered 2D passages', () => {
    const source = `% Link Projection
2
0 1
2 3
4
0 0
10 10
0 10
10 0
2
0 1
2 3
1
0 1
-1`
    const data = importPLink2D(source)
    expect(data.elements).toHaveLength(2)
    expect(data.crossings).toEqual([
      { id: 'crossing-0', element: 'edge-0', type: 'classical', overElement: 'edge-1' },
      { id: 'crossing-0', element: 'edge-1', type: 'classical', underElement: 'edge-0' },
    ])
  })

  it('rejects unsupported headers and dangling edges', () => {
    expect(() => parsePLinkProjection(ordinary.replace('% Link Projection', '% Unknown'))).toThrow('header')
    expect(() => parsePLinkProjection(ordinary.replace('0 1\n0\n-1', '0 9\n0\n-1'))).toThrow('edge')
  })
})
