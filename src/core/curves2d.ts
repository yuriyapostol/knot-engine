import type { Curve2D, Geometry2DData, FlattenedGeometry2DData, InterpolatedCurve2D, SegmentedCurve2D, Point2D } from './knot'

const midpoint = (a: Point2D, b: Point2D): Point2D => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const extrapolate = (a: Point2D, b: Point2D): Point2D => [2 * a[0] - b[0], 2 * a[1] - b[1]]

/** All authored points, including handles, for budgets and coordinate transforms. */
export function curveControlPoints2D(curve: Curve2D): Point2D[] {
  if (!('segments' in curve)) return curve.points
  return [curve.start, ...curve.segments.flatMap(s => s.type === 'line' ? [s.end] : s.type === 'quadratic' ? [s.control, s.end] : [s.control1, s.control2, s.end])]
}

export function mapCurve2D(curve: SegmentedCurve2D, map: (p: Point2D) => Point2D): SegmentedCurve2D
export function mapCurve2D(curve: InterpolatedCurve2D, map: (p: Point2D) => Point2D): InterpolatedCurve2D
export function mapCurve2D(curve: Curve2D, map: (p: Point2D) => Point2D): Curve2D
export function mapCurve2D(curve: Curve2D, map: (p: Point2D) => Point2D): Curve2D {
  if (!('segments' in curve)) return { ...curve, points: curve.points.map(map) }
  return { ...curve, start: map(curve.start), segments: curve.segments.map(s => {
    if (s.type === 'line') return { ...s, end: map(s.end) }
    if (s.type === 'quadratic') return { ...s, control: map(s.control), end: map(s.end) }
    return { ...s, control1: map(s.control1), control2: map(s.control2), end: map(s.end) }
  }) }
}

const lerp = (a: Point2D, b: Point2D, t: number): Point2D => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const equal = (a: Point2D, b: Point2D) => a[0] === b[0] && a[1] === b[1]

/** Exact cubic spans for authored segments or Catmull–Rom (including closing spans). */
export function cubicSpans(curve: Curve2D): [Point2D, Point2D, Point2D, Point2D][] {
  if ('segments' in curve) {
    let start = curve.start
    const spans: [Point2D, Point2D, Point2D, Point2D][] = curve.segments.map(s => {
      const a = start
      start = s.end
      if (s.type === 'line') return [a, lerp(a, s.end, 1 / 3), lerp(a, s.end, 2 / 3), s.end]
      if (s.type === 'quadratic') return [a, lerp(a, s.control, 2 / 3), lerp(s.end, s.control, 2 / 3), s.end]
      return [a, s.control1, s.control2, s.end]
    })
    if (curve.closed && !equal(start, curve.start)) spans.push([start, lerp(start, curve.start, 1 / 3), lerp(start, curve.start, 2 / 3), curve.start])
    return spans
  }
  const interpolation = curve.interpolation
  if (interpolation.type === 'polyline') return []
  const points = curve.points, n = points.length
  const spans: [Point2D, Point2D, Point2D, Point2D][] = []
  for (let i = 0; i < n - Number(!curve.closed); i++) {
    const p1 = points[i], p2 = points[(i + 1) % n]
    const p0 = i ? points[i - 1] : curve.closed ? points[n - 1] : extrapolate(p1, p2)
    const p3 = i + 2 < n ? points[i + 2] : curve.closed ? points[(i + 2) % n] : extrapolate(p2, p1)
    const power = interpolation.parameterization === 'chordal' ? 1 : 0.5
    const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) ** power
    const d1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) ** power
    const d2 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) ** power
    const c1: Point2D = [0, 0], c2: Point2D = [0, 0]
    for (const k of [0, 1] as const) {
      const t1 = interpolation.parameterization === 'uniform'
        ? interpolation.tension * (p2[k] - p0[k])
        : d1 * ((p1[k] - p0[k]) / d0 - (p2[k] - p0[k]) / (d0 + d1) + (p2[k] - p1[k]) / d1)
      const t2 = interpolation.parameterization === 'uniform'
        ? interpolation.tension * (p3[k] - p1[k])
        : d1 * ((p2[k] - p1[k]) / d1 - (p3[k] - p1[k]) / (d1 + d2) + (p3[k] - p2[k]) / d2)
      c1[k] = p1[k] + t1 / 3
      c2[k] = p2[k] - t2 / 3
    }
    spans.push([p1, c1, c2, p2])
  }
  return spans
}

/** Flatten cubics with a control-polygon error bound; never silently exceed the budget. */
export function flattenGeometry2D(data: Geometry2DData): FlattenedGeometry2DData {
  const all = data.elements.flatMap(curveControlPoints2D)
  const xs = all.map(p => p[0]), ys = all.map(p => p[1])
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('Invalid 2D coordinate extent')
  const tolerance = extent * 1e-5
  let segments = 0
  function count() { if (++segments > 2048) throw new Error('Too many 2D segments for crossing detection (including spline subdivision)') }
  const elements = data.elements.map(curve => {
    if (!('segments' in curve) && curve.interpolation.type === 'polyline') {
      segments += curve.points.length - Number(!curve.closed)
      if (segments > 2048) throw new Error('Too many 2D segments for crossing detection')
      return curve
    }
    const points: Point2D[] = ['segments' in curve ? curve.start : curve.points[0]]
    function flatten(span: [Point2D, Point2D, Point2D, Point2D], depth: number) {
      const [a, b, c, d] = span
      const dx = d[0] - a[0], dy = d[1] - a[1], length2 = dx * dx + dy * dy
      const distance = (p: Point2D) => {
        const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0
        return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
      }
      if (Math.max(distance(b), distance(c)) <= tolerance) { count(); if (!equal(points.at(-1)!, d)) points.push(d); return }
      if (depth >= 20) throw new Error('2D spline subdivision did not converge')
      const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d)
      const abc = midpoint(ab, bc), bcd = midpoint(bc, cd), middle = midpoint(abc, bcd)
      flatten([a, ab, abc, middle], depth + 1)
      flatten([middle, bcd, cd, d], depth + 1)
    }
    for (const span of cubicSpans(curve)) flatten(span, 0)
    if (curve.closed) points.pop()
    if (points.length < (curve.closed ? 3 : 2)) throw new Error('Degenerate 2D curve has no renderable spans')
    return { id: curve.id, type: 'curve' as const, ...(curve.object === undefined ? {} : { object: curve.object }), closed: curve.closed, interpolation: { type: 'polyline' as const }, points }
  })
  return { ...data, elements }
}

export function curvePath2D(curve: Curve2D, formatNumber: (value: number) => string = String): string {
  const point = (p: Point2D) => `${formatNumber(p[0])} ${formatNumber(-p[1])}`
  if ('segments' in curve) {
    return `M ${point(curve.start)} ` + curve.segments.map(s => {
      if (s.type === 'line') return `L ${point(s.end)}`
      if (s.type === 'quadratic') return `Q ${point(s.control)} ${point(s.end)}`
      return `C ${point(s.control1)} ${point(s.control2)} ${point(s.end)}`
    }).join(' ') + (curve.closed ? ' Z' : '')
  }
  const spans = cubicSpans(curve)
  const path = spans.length
    ? `M ${point(curve.points[0])} ` + spans.map(([, b, c, d]) => `C ${point(b)} ${point(c)} ${point(d)}`).join(' ')
    : curve.points.map((p, i) => `${i ? 'L' : 'M'} ${point(p)}`).join(' ')
  return path + (curve.closed ? ' Z' : '')
}
