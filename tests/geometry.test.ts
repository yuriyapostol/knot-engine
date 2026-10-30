import { expect, it } from 'vitest'
import { GEOMETRY_2D, GEOMETRY_3D, type Geometry2DData, type Geometry3DData } from '../src/core/knot'
import { validateGeometry2D, validateGeometry3D, applyStepData } from '../src/core/validateGeometry'
import { validateKnot } from '../src/core/validateKnot'

const curve = (id: string, points: [number, number][]) => ({ id, type: 'curve' as const, closed: false, interpolation: { type: 'polyline' as const }, points })
const two: Geometry2DData = {
  coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } },
  elements: [curve('a', [[0, 0], [2, 2]]), curve('b', [[0, 2], [2, 0]])],
  crossings: [{ id: 'x', element: 'a', underElement: 'b' }, { id: 'x', element: 'b', overElement: 'a' }]
}
const three: Geometry3DData = {
  coordinateSystem: { handedness: 'right', upAxis: 'y', scale: { kind: 'relative' } },
  elements: [{ id: 'mesh', type: 'mesh', vertices: [[0,0,0],[1,0,0],[0,1,0]], faces: [[0,1,2]] }]
}
it('accepts both geometry contracts and checks crossing pair relationships', () => {
  expect(validateGeometry2D(two).valid).toBe(true)
  expect(validateGeometry3D(three).valid).toBe(true)
  expect(validateGeometry2D({ ...two, crossings: [two.crossings![0]] }).valid).toBe(false)
  expect(validateGeometry2D({ ...two, crossings: [two.crossings![0], { id: 'x', element: 'b', underElement: 'a' }] }).valid).toBe(false)
  expect(validateGeometry3D({ ...three, elements: [{ ...three.elements[0], faces: [[0,1,9]] }] }).valid).toBe(false)
})
it('applies each step independently to the base and never mutates it', () => {
  const first = applyStepData(two, { replace: [curve('a', [[0, 0], [2, 0]])], crossings: [] }, GEOMETRY_2D)
  expect(first.valid).toBe(true)
  if (first.valid) expect((first.data as Geometry2DData).crossings).toEqual([])
  expect(two.crossings).toHaveLength(2)
  const second = applyStepData(two, { remove: ['b'], crossings: [] }, GEOMETRY_2D)
  expect(second.valid).toBe(true)
  if (second.valid) expect(second.data.elements.map(e => e.id)).toEqual(['a'])
  expect(two.elements).toHaveLength(2)
  expect(applyStepData(two, { remove: ['missing'] }, GEOMETRY_2D).valid).toBe(false)
  expect(applyStepData(two, { remove: ['a'], replace: [curve('a', [[0,0],[1,1]])] }, GEOMETRY_2D).valid).toBe(false)
  expect(applyStepData(three, { crossings: [] }, GEOMETRY_3D).valid).toBe(false)
})
it('accepts built-in geometry types in a Knot and resolves procedure base references', () => {
  const knot = {
    schema: 'Knot', schemaVersion: 1, id: 'test', subject: { id: 'subject' },
    representations: [{ id: 'final', type: GEOMETRY_2D, data: two }],
    procedures: [{ id: 'tying', base: { id: 'final' }, steps: [
      { id: 'start', data: { crossings: [] } }, { id: 'final' }
    ] }]
  }
  expect(validateKnot(knot).valid).toBe(true)
  expect(validateKnot({ ...knot, procedures: [{ ...knot.procedures[0], base: { id: 'missing' } }] }).valid).toBe(false)
  expect(validateKnot({ ...knot, procedures: [{ ...knot.procedures[0], steps: [{ id: 'bad', data: { remove: ['missing'] } }] }] }).valid).toBe(false)
})
