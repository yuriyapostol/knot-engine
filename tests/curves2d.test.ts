import { expect, it } from 'vitest'
import { CatmullRomCurve3, Vector3 } from 'three'
import { cubicSpans, curvePath2D, flattenGeometry2D } from '../src/components/curves2d'
import { locateCrossings } from '../src/components/geometry2d'
import type { Curve2D, Geometry2DData, Interpolation } from '../src/core'

const interpolations: Interpolation[] = [
  { type: 'catmull-rom', parameterization: 'uniform', tension: 0.3 },
  { type: 'catmull-rom', parameterization: 'centripetal' },
  { type: 'catmull-rom', parameterization: 'chordal' },
]
const model = (elements: Curve2D[]): Geometry2DData => ({ coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } }, elements })
for (const interpolation of interpolations) for (const closed of [false, true]) {
  it(`matches 3D interpolation for ${interpolation.type === 'catmull-rom' && interpolation.parameterization}, closed=${closed}`, () => {
    if (interpolation.type !== 'catmull-rom') return
    const curve: Curve2D = { id: 'a', type: 'curve', closed, interpolation, points: [[0, 0], [1, 2], [4, 1], [3, -2]] }
    const reference = new CatmullRomCurve3(curve.points.map(p => new Vector3(...p, 0)), closed, interpolation.parameterization === 'uniform' ? 'catmullrom' : interpolation.parameterization, interpolation.parameterization === 'uniform' ? interpolation.tension : undefined)
    const spans = cubicSpans(curve)
    spans.forEach(([a, b, c, d], i) => {
      for (const t of [0, 0.2, 0.5, 0.8, 1]) {
        const point = reference.getPoint((i + t) / spans.length)
        for (const k of [0, 1] as const) {
          const actual = (1 - t) ** 3 * a[k] + 3 * (1 - t) ** 2 * t * b[k] + 3 * (1 - t) * t ** 2 * c[k] + t ** 3 * d[k]
          expect(actual).toBeCloseTo(k === 0 ? point.x : point.y, 10)
        }
      }
    })
    expect(curvePath2D(curve)).toContain('C ')
    expect(curvePath2D(curve).endsWith(' Z')).toBe(closed)
    const flattened = flattenGeometry2D(model([curve])).elements[0]
    expect(flattened.points.length).toBeGreaterThan(curve.points.length)
    expect(flattened.points[0]).toEqual(curve.points[0])
    expect(flattened.points.at(-1)).not.toEqual(flattened.points[0])
  })
}

for (const interpolation of interpolations) it(`matches actual curved intersections for ${interpolation.type === 'catmull-rom' && interpolation.parameterization}`, () => {
  const curve: Curve2D = { id: 'a', type: 'curve', closed: false, interpolation, points: [[-2, -1], [0, 0], [2, 2]] }
  const crossing: Geometry2DData = { ...model([curve, { id: 'b', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[0, -2], [0, 2]] }]), crossings: [
    { id: 'x', element: 'a', underElement: 'b' }, { id: 'x', element: 'b', overElement: 'a' },
  ] }
  expect(locateCrossings(crossing)).toHaveLength(2)
})

it('enforces the subdivision budget instead of hanging on large splines', () => {
  const curve: Curve2D = { id: 'a', type: 'curve', closed: false, interpolation: { type: 'catmull-rom', parameterization: 'centripetal' }, points: Array.from({ length: 3000 }, (_, i) => [i, i % 2]) }
  expect(() => flattenGeometry2D(model([curve]))).toThrow(/Too many/)
})

for (const interpolation of interpolations) it(`matches closed-curve and self-crossings for ${interpolation.type === 'catmull-rom' && interpolation.parameterization}`, () => {
  const closed: Curve2D = { id: 'a', type: 'curve', closed: true, interpolation, points: [[-1, -1], [1, -1], [1, 1], [-1, 1]] }
  const crossing: Geometry2DData = { ...model([closed, { id: 'b', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[-2, 0], [2, 0]] }]), crossings: [
    { id: 'right', element: 'a', underElement: 'b' }, { id: 'left', element: 'a', overElement: 'b' },
    { id: 'left', element: 'b', underElement: 'a' }, { id: 'right', element: 'b', overElement: 'a' },
  ] }
  const positions = locateCrossings(crossing)
  expect(positions).toHaveLength(4)
  expect(positions[0].x).toBeGreaterThan(1)
  expect(positions[1].x).toBeLessThan(-1)
  const self: Geometry2DData = { ...model([{ ...closed, closed: false, points: [[0, 0], [2, 2], [0, 2], [2, 0]] }]), crossings: [
    { id: 'self', element: 'a', underElement: 'a' }, { id: 'self', element: 'a', overElement: 'a' },
  ] }
  expect(locateCrossings(self).map(p => p.over)).toEqual([true, false])
})
