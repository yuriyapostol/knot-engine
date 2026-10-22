import { describe, expect, it } from 'vitest'
import { mosaicPaths } from '../src/components/mosaicGeometry'
import { LOMONACO_KAUFFMAN_11, type MosaicDiagram } from '../src/core'
describe('mosaic SVG geometry', () => {
  it('keeps tile codes and positions without mutating the diagram', () => {
    const diagram: MosaicDiagram = { tileSet: LOMONACO_KAUFFMAN_11, tiles: [[2,1],[3,4]] }
    const before = JSON.stringify(diagram)
    const paths = mosaicPaths(diagram)
    expect(paths).toHaveLength(4)
    expect(paths[0].transform).toBe('translate(0 0)')
    expect(paths[3].transform).toBe('translate(1 1)')
    expect(JSON.stringify(diagram)).toBe(before)
  })
  it('draws crossing strands separately and distinguishes overpasses', () => {
    const data = (code: 9 | 10): MosaicDiagram => ({ tileSet: LOMONACO_KAUFFMAN_11, tiles: [[code]] })
    const a = mosaicPaths(data(9)), b = mosaicPaths(data(10))
    expect(a).toHaveLength(3)
    expect(b).toHaveLength(3)
    expect(a.map(p => p.d)).not.toEqual(b.map(p => p.d))
  })
  it('renders blank tiles as no paths', () => {
    expect(mosaicPaths({ tileSet: LOMONACO_KAUFFMAN_11, tiles: [[0]] })).toEqual([])
  })
})
