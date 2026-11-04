import { mapCurve2D } from '../src/core/curves2d'
import { expect, it } from 'vitest'
import { locateCrossings } from '../src/components/geometry2d'
import { applyStepData } from '../src/core/validateGeometry'
import { GEOMETRY_2D } from '../src/core/knot'
import { readFileSync } from 'node:fs'
import type { Geometry2DData, Curve2D } from '../src/core/knot'
const curve = (id: string, points: [number, number][]): Curve2D => ({ id, type: 'curve', closed: false, interpolation: { type: 'polyline' }, points })
const data: Geometry2DData = {
  coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } },
  elements: [curve('a', [[0,0],[2,2]]), curve('b', [[0,2],[2,0]])],
  crossings: [{ id: 'x', element: 'a', underElement: 'b' }, { id: 'x', element: 'b', overElement: 'a' }]
}
it('locates crossing and distinguishes overpass', () => {
  const positions = locateCrossings(data)
  expect(positions).toHaveLength(2)
  expect(positions[0]).toMatchObject({ id: 'x', element: 'a', x: 1, y: 1, over: true })
  expect(positions[1]).toMatchObject({ id: 'x', element: 'b', x: 1, y: 1, over: false })
})
it('rejects mismatched crossing IDs and incomplete crossing records', () => {
  expect(() => locateCrossings({ ...data, crossings: [] })).toThrow()
  expect(() => locateCrossings({ ...data, crossings: [{ ...data.crossings![0], id: 'other' }, data.crossings![1]] })).toThrow()
})
it('locates a self-crossing twice on one curve', () => {
  const self: Geometry2DData = {
    ...data, elements: [curve('a', [[0,0],[2,2],[0,2],[2,0]])],
    crossings: [{ id: 'self', element: 'a', underElement: 'a' }, { id: 'self', element: 'a', overElement: 'a' }]
  }
  const positions = locateCrossings(self)
  expect(positions.map(p => p.segment)).toEqual([0,2])
  expect(positions.map(p => p.over)).toEqual([true,false])
})
it('locates crossings for interpolated splines', () => {
  const spline: Geometry2DData = { ...data, elements: [{ ...data.elements[0], interpolation: { type: 'catmull-rom', parameterization: 'centripetal' } }, data.elements[1]] }
  expect(locateCrossings(spline)).toHaveLength(2)
})

it('renders geometric crossings consistently across independent example algorithm steps', () => {
  const example = JSON.parse(readFileSync('v1/examples/knots/geometry-crossing-demo.json', 'utf8'))
  const base = example.representations.find((r: { id: string }) => r.id === 'crossing-2d').data as Geometry2DData
  expect(locateCrossings(base)).toHaveLength(2)
  const algorithm = example.algorithms[0]
  const before = applyStepData(base, algorithm.steps[0].data, GEOMETRY_2D)
  expect(before.valid).toBe(true)
  if (before.valid) expect(locateCrossings(before.data as Geometry2DData)).toEqual([])
  expect(locateCrossings(base)).toHaveLength(2)
})

for (const factor of [1e-8, 1, 1e8]) it(`handles transverse intersections at vertices at scale ${factor}`, () => {
  const model: Geometry2DData = { ...data, elements: [curve('a', [[0, 0], [1, 1], [2, 2]]), curve('b', [[0, 2], [1, 1], [2, 0]])] }
  model.elements = model.elements.map(c => mapCurve2D(c, p => [p[0] * factor, p[1] * factor]))
  const positions = locateCrossings(model)
  expect(positions).toHaveLength(2)
  expect(positions[0].x / factor).toBeCloseTo(1)
})

it('rejects endpoint contacts, tangencies, overlaps and triple intersections', () => {
  for (const points of [
    [[1, 1], [2, 0]], // endpoint on a
    [[0, 2], [1, 1], [2, 2]], // touching without crossing
    [[0.5, 0.5], [1.5, 1.5]], // overlap
  ] as [number, number][][]) expect(() => locateCrossings({ ...data, elements: [data.elements[0], curve('b', points)] })).toThrow(/contact|tangen|overlap/)
  expect(() => locateCrossings({ ...data, elements: [...data.elements, curve('c', [[1, -1], [1, 3]])] })).toThrow(/multiple/)
})

it('matches repeated crossings on a closed curve in traversal order', () => {
  const square = { ...curve('a', [[0, 0], [2, 0], [2, 2], [0, 2]]), closed: true }
  const model: Geometry2DData = { ...data, elements: [square, curve('b', [[-1, 1], [3, 1]])], crossings: [
    { id: 'right', element: 'a', underElement: 'b' }, { id: 'left', element: 'a', overElement: 'b' },
    { id: 'left', element: 'b', underElement: 'a' }, { id: 'right', element: 'b', overElement: 'a' },
  ] }
  expect(locateCrossings(model).map(p => [p.id, p.x, p.y])).toEqual([
    ['right', 2, 1], ['left', 0, 1], ['left', 0, 1], ['right', 2, 1],
  ])
})

it('rejects adjacent backtracking and caps dense intersection arrangements', () => {
  expect(() => locateCrossings({ ...data, elements: [curve('a', [[0, 0], [2, 0], [1, 0]])], crossings: [] })).toThrow(/overlapping adjacent/)
  const dense: Geometry2DData = { ...data, elements: Array.from({ length: 100 }, (_, i) => curve(`line-${i}`, [[-1, -i + i * i * 1e-4], [1, i + i * i * 1e-4]])), crossings: [] }
  expect(() => locateCrossings(dense)).toThrow(/Too many 2D intersections/)
})

it('deduplicates spline vertex intersections despite floating-point parameter differences', () => {
  const spline: Geometry2DData = { ...data, elements: [{ ...curve('a', [[0, 0], [1, 1], [2, 2.5]]), interpolation: { type: 'catmull-rom', parameterization: 'centripetal' } }, data.elements[1]] }
  expect(locateCrossings(spline)).toHaveLength(2)
})

it('deduplicates a self-crossing at the closed-curve seam and orders it first', () => {
  const self: Geometry2DData = { ...data, elements: [{ ...curve('a', [[1, 1], [2, 2], [0, 2], [2, 0], [0, 0]]), closed: true }], crossings: [
    { id: 'x', element: 'a', underElement: 'a' }, { id: 'x', element: 'a', overElement: 'a' },
  ] }
  expect(locateCrossings(self).map(p => p.segment)).toEqual([0, 2])
})
