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
it('does not silently draw crossings for interpolated splines', () => {
  const spline: Geometry2DData = { ...data, elements: [{ ...data.elements[0], interpolation: { type: 'catmull-rom', parameterization: 'centripetal' } }, data.elements[1]] }
  expect(() => locateCrossings(spline)).toThrow(/polyline/)
})

it('renders geometric crossings consistently across independent example procedure steps', () => {
  const example = JSON.parse(readFileSync('v1/examples/knots/geometry-crossing-demo.json', 'utf8'))
  const base = example.representations.find((r: { id: string }) => r.id === 'crossing-2d').data as Geometry2DData
  expect(locateCrossings(base)).toHaveLength(2)
  const procedure = example.procedures[0]
  const before = applyStepData(base, procedure.steps[0].data, GEOMETRY_2D)
  expect(before.valid).toBe(true)
  if (before.valid) expect(locateCrossings(before.data as Geometry2DData)).toEqual([])
  expect(locateCrossings(base)).toHaveLength(2)
})
