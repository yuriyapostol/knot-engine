import type { Geometry2DData } from '../core/knot'
import type { CrossingPosition } from './geometry2d'
import { curvePath2D } from './curves2d'

export const CROSSING_MASK_SCALE = 2.3

type Interval = [number, number]
export interface CrossingStroke2D {
  id: string
  d: string
  length: number
  over: { array: string; offset: number } | null
}

/** Reuse complete SVG curves; dashes select overpasses by distance along each curve. */
export function crossingStrokes2D(data: Geometry2DData, flattened: Geometry2DData, positions: CrossingPosition[]): CrossingStroke2D[] {
  const metrics = new Map(flattened.elements.map(curve => {
    const distances = [0]
    const segments = curve.points.length - Number(!curve.closed)
    for (let i = 0; i < segments; i++) {
      const a = curve.points[i], b = curve.points[(i + 1) % curve.points.length]
      distances.push(distances[i] + Math.hypot(b[0] - a[0], b[1] - a[1]))
    }
    return [curve.id, { curve, distances, length: distances[segments] }] as const
  }))
  const offset = (position: CrossingPosition) => {
    const metric = metrics.get(position.element)!
    const distance = metric.distances[position.segment] + position.t * (metric.distances[position.segment + 1] - metric.distances[position.segment])
    return metric.curve.closed ? ((distance % metric.length) + metric.length) % metric.length : distance
  }
  return data.elements.map(curve => {
    const metric = metrics.get(curve.id)!, length = metric.length
    const passages = positions.filter(p => p.element === curve.id)
      .map(position => ({ position, distance: offset(position) }))
      .sort((a, b) => a.distance - b.distance)
    const intervals: Interval[] = []
    for (const [i, passage] of passages.entries()) {
      if (!passage.position.over) continue
      const center = passage.distance
      const previous = i ? passages[i - 1].distance : curve.closed ? passages.at(-1)!.distance - length : null
      const next = i + 1 < passages.length ? passages[i + 1].distance : curve.closed ? passages[0].distance + length : null
      // Partition the curve at arc-length midpoints between every pair of
      // neighboring passages. Open ends belong to the nearest passage.
      const start = previous === null ? 0 : (previous + center) / 2
      const end = next === null ? length : (center + next) / 2
      if (curve.closed && end - start >= length) intervals.push([0, length])
      else if (start < 0) intervals.push([0, end], [length + start, length])
      else if (end > length) intervals.push([start, length], [0, end - length])
      else intervals.push([start, end])
    }
    const merged: Interval[] = []
    for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
      const previous = merged.at(-1)
      if (previous && interval[0] <= previous[1] + length * 1e-12) previous[1] = Math.max(previous[1], interval[1])
      else if (interval[1] > interval[0]) merged.push([...interval])
    }
    let over: CrossingStroke2D['over'] = null
    if (merged.length) {
      // Rotate the dash pattern to the first window instead of inserting a
      // zero-length dash, which would paint a dot with round line caps.
      const array = merged.flatMap(([start, end], i) => [end - start, i + 1 < merged.length ? merged[i + 1][0] - end : length - end + merged[0][0]])
      if (merged.length === 1 && merged[0][0] === 0 && merged[0][1] === length) array[1] = length
      over = { array: array.join(' '), offset: -merged[0][0] }
    }
    return { id: curve.id, d: curvePath2D(curve), length, over }
  })
}
