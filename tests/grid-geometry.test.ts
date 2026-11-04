import { expect, it } from 'vitest'
import { gridGeometry } from '../src/components/gridGeometry'
import { validateGridDiagram, type GridXODiagram, type GridVertexPairsDiagram } from '../src/core'

const xo: GridXODiagram = { encoding: 'xo', size: 5, x: [0,1,2,3,4], o: [2,3,4,0,1] }
const pairs: GridVertexPairsDiagram = { encoding: 'vertex-pairs', size: 5, vertices: xo.x.flatMap((r,c) => [[c,r], [c,xo.o[c]]] as [number,number][]) }

it('uses column/row coordinates without transposition or reflection and marks only xo', () => {
  const result = gridGeometry(xo)
  expect(result.fit).toEqual({ center: [2.5,2.5], height: 5 })
  expect(result.markers.slice(0,2)).toEqual([{ kind: 'x', position: [0.5,0.5] }, { kind: 'o', position: [0.5,2.5] }])
  expect(result.vertical[0]).toEqual({ start: [0.5,0.7], end: [0.5,2.3] })
  expect(gridGeometry(pairs).markers).toEqual([])
  expect(gridGeometry(pairs).vertical[0]).toEqual({ start: [0.5,0.5], end: [0.5,2.5] })
})

it('cuts only strict interior horizontal crossings and keeps vertical overpasses intact', () => {
  for (const data of [xo,pairs]) {
    const result = gridGeometry(data), validation = validateGridDiagram(data)
    expect(validation.valid).toBe(true)
    expect(result.vertical).toHaveLength(data.size)
    expect(result.horizontal.length - data.size).toBe(validation.valid && validation.crossingCount)
    expect(result.horizontal).toContainEqual({ start: [1.66,2.5], end: [data.encoding === 'xo' ? 2.3 : 2.5,2.5] })
    expect(result.vertical[1].start[1]).toBeLessThan(2.5)
    expect(result.vertical[1].end[1]).toBeGreaterThan(2.5)
  }
  expect(gridGeometry({ encoding: 'vertex-pairs', size: 2, vertices: [[0,0],[0,1],[1,0],[1,1]] }).horizontal).toHaveLength(2)
})

it('preserves unoriented geometry under vertex reordering and xo geometry under reversal', () => {
  const before = JSON.stringify([xo,pairs])
  expect(gridGeometry({ ...pairs, vertices: [...pairs.vertices].reverse() })).toEqual(gridGeometry(pairs))
  const reversed = gridGeometry({ ...xo, x: xo.o, o: xo.x }), original = gridGeometry(xo)
  expect(reversed.horizontal).toEqual(original.horizontal)
  expect(reversed.vertical).toEqual(original.vertical)
  expect(JSON.stringify([xo,pairs])).toBe(before)
})
