import { expect, it } from 'vitest'
import { crossingStrokes2D } from '../src/components/crossingStrokes2d'
import { flattenGeometry2D } from '../src/components/curves2d'
import { locateCrossings } from '../src/components/geometry2d'
import type { CrossingPosition } from '../src/components/geometry2d'
import type { InterpolatedCurve2D as Curve2D, FlattenedGeometry2DData, Geometry2DData } from '../src/core'

const curve = (id: string, points: [number, number][], closed = false): Curve2D => ({ id, type: 'curve', points, closed, interpolation: { type: 'polyline' } })
const model = (elements: Curve2D[], crossings: Geometry2DData['crossings'] = []): FlattenedGeometry2DData => ({ coordinateSystem: { xAxis: 'right', yAxis: 'up', scale: { kind: 'relative' } }, elements, crossings })
function strokes(data: Geometry2DData, width = 0.04) {
  const flattened = flattenGeometry2D(data)
  return crossingStrokes2D(data, flattened, locateCrossings(flattened), width)
}

it('uses the full open curve when its only passage is an overpass, regardless of crossing angle', () => {
  for (const slope of [0.08, 1, 10]) {
    const data = model([curve('a', [[-2, 0], [2, 0]]), curve('b', [[-2, -2 * slope], [2, 2 * slope]])], [
      { id: 'x', element: 'a', underElement: 'b' }, { id: 'x', element: 'b', overElement: 'a' },
    ])
    const [over, under] = strokes(data)
    expect(over.over!.array.split(' ').map(Number)).toEqual([4, 4])
    expect(over.over!.offset).toBeCloseTo(0)
    expect(under.over).toBeNull()
  }
})

it('wraps a self-crossing window across the closed-curve seam', () => {
  const data = model([curve('a', [[1, 1], [2, 2], [0, 2], [2, 0], [0, 0]], true)], [
    { id: 'x', element: 'a', underElement: 'a' }, { id: 'x', element: 'a', overElement: 'a' },
  ])
  const [stroke] = strokes(data)
  const pattern = stroke.over!.array.split(' ').map(Number)
  expect(pattern[0]).toBeGreaterThan(0)
  expect(pattern.at(-1)).toBe(stroke.length)
  expect(stroke.over!.offset).toBeCloseTo(0)
  expect(pattern.reduce((a, b) => a + b, 0)).toBeGreaterThan(stroke.length)
  // Two passages divide a closed curve into equally long upper and lower regions.
  expect(pattern[0] + pattern[2]).toBeCloseTo(stroke.length / 2)
  expect(pattern[1]).toBeCloseTo(stroke.length / 2)
})

it('uses distance along a bent curve and includes upper as well as lower neighbors', () => {
  const data = model([curve('a', [[0, 0], [10, 0], [10, 10], [0, 10]])])
  const passage = (id: string, segment: number, t: number, over: boolean): CrossingPosition => ({ id, element: 'a', segment, t, over, x: 0, y: 0 })
  // Arc-length positions: 2 (under), 12 (over), 18 (over), 26 (under).
  // The upper cells [7,15] and [15,22] merge, even though the curve turns.
  const [stroke] = crossingStrokes2D(data, data, [passage('d', 2, 0.6, false), passage('b', 1, 0.2, true), passage('a', 0, 0.2, false), passage('c', 1, 0.8, true)], 0.04)
  expect(stroke.over!.offset).toBeCloseTo(-7)
  expect(stroke.over!.array.split(' ').map(Number)).toEqual([15, 37])
})

it('extends the first and last upper passages to open ends and leaves the middle lower passage clear', () => {
  const data = model([curve('a', [[0, 0], [10, 0]])])
  const passages: CrossingPosition[] = [
    { id: 'a', element: 'a', segment: 0, t: 0.1, x: 1, y: 0, over: true },
    { id: 'b', element: 'a', segment: 0, t: 0.4, x: 4, y: 0, over: false },
    { id: 'c', element: 'a', segment: 0, t: 0.9, x: 9, y: 0, over: true },
  ]
  const [stroke] = crossingStrokes2D(data, data, passages, 0.04)
  expect(stroke.over!.array.split(' ').map(Number)).toEqual([2.5, 4, 3.5, 10])
  expect(stroke.over!.offset).toBeCloseTo(0)
})

it('draws complementary rounded layers and insets the mask by exactly one stroke radius', () => {
  const data = model([curve('a', [[0, 0], [10, 0]])])
  const positions: CrossingPosition[] = [
    { id: 'a', element: 'a', segment: 0, t: 0.2, x: 2, y: 0, over: false },
    { id: 'b', element: 'a', segment: 0, t: 0.8, x: 8, y: 0, over: true },
  ]
  const [stroke] = crossingStrokes2D(data, data, positions, 0.4)
  expect(stroke.under!.array.split(' ').map(Number)).toEqual([5, 10])
  expect(stroke.under!.offset).toBeCloseTo(0)
  expect(stroke.over!.array.split(' ').map(Number)).toEqual([5, 15])
  expect(stroke.over!.offset).toBeCloseTo(-5)
  expect(Number(stroke.mask!.array.split(' ')[0])).toBeCloseTo(4.6)
  expect(stroke.mask!.offset).toBeCloseTo(-5.2)
  for (const pattern of [stroke.over!, stroke.under!, stroke.mask!]) {
    const parts = pattern.array.split(' ').map(Number)
    expect(parts.every(n => n > 0)).toBe(true)
    expect(parts.reduce((a, b) => a + b, 0)).toBeGreaterThan(stroke.length)
  }
})

it('insets across a closed seam even when the radius consumes the entire first piece', () => {
  const data = model([curve('a', [[0, 0], [10, 0], [10, 10], [0, 10]], true)])
  const positions: CrossingPosition[] = [
    { id: 'a', element: 'a', segment: 0, t: 0.03, x: 0.3, y: 0, over: false },
    { id: 'b', element: 'a', segment: 3, t: 0.99, x: 0, y: 0.1, over: true },
  ]
  const [stroke] = crossingStrokes2D(data, data, positions, 0.4)
  expect(stroke.mask!.offset).toBeCloseTo(-20.3)
  expect(Number(stroke.mask!.array.split(' ')[0])).toBeCloseTo(19.6)
})

it('omits an inset mask that is shorter than the stroke diameter instead of painting a zero-length dash', () => {
  const data = model([curve('a', [[0, 0], [10, 0]])])
  const positions: CrossingPosition[] = [
    { id: 'a', element: 'a', segment: 0, t: 0.4, x: 4, y: 0, over: false },
    { id: 'b', element: 'a', segment: 0, t: 0.5, x: 5, y: 0, over: true },
    { id: 'c', element: 'a', segment: 0, t: 0.6, x: 6, y: 0, over: false },
  ]
  expect(crossingStrokes2D(data, data, positions, 2)[0].mask).toBeNull()
})
