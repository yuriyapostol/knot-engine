import type { Curve2D, Geometry2DData, Point2D } from '../core/knot'

const midpoint = (a: Point2D, b: Point2D): Point2D => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const extrapolate = (a: Point2D, b: Point2D): Point2D => [2 * a[0] - b[0], 2 * a[1] - b[1]]

/** Cubic Bezier spans equivalent to the contract's Catmull–Rom interpolation. */
export function cubicSpans(curve: Curve2D): [Point2D, Point2D, Point2D, Point2D][] {
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
export function flattenGeometry2D(data: Geometry2DData): Geometry2DData {
  const all = data.elements.flatMap(e => e.points)
  const xs = all.map(p => p[0]), ys = all.map(p => p[1])
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
  if (!Number.isFinite(extent) || extent <= 0) throw new Error('Invalid 2D coordinate extent')
  const tolerance = extent * 1e-5
  let segments = 0
  function count() { if (++segments > 2048) throw new Error('Too many 2D segments for crossing detection (including spline subdivision)') }
  const elements = data.elements.map(curve => {
    if (curve.interpolation.type === 'polyline') {
      segments += curve.points.length - Number(!curve.closed)
      if (segments > 2048) throw new Error('Too many 2D segments for crossing detection')
      return curve
    }
    const points: Point2D[] = [curve.points[0]]
    function flatten(span: [Point2D, Point2D, Point2D, Point2D], depth: number) {
      const [a, b, c, d] = span
      const dx = d[0] - a[0], dy = d[1] - a[1], length2 = dx * dx + dy * dy
      const distance = (p: Point2D) => {
        const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2)) : 0
        return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
      }
      if (Math.max(distance(b), distance(c)) <= tolerance) { count(); points.push(d); return }
      if (depth >= 20) throw new Error('2D spline subdivision did not converge')
      const ab = midpoint(a, b), bc = midpoint(b, c), cd = midpoint(c, d)
      const abc = midpoint(ab, bc), bcd = midpoint(bc, cd), middle = midpoint(abc, bcd)
      flatten([a, ab, abc, middle], depth + 1)
      flatten([middle, bcd, cd, d], depth + 1)
    }
    for (const span of cubicSpans(curve)) flatten(span, 0)
    if (curve.closed) points.pop()
    return { ...curve, interpolation: { type: 'polyline' as const }, points }
  })
  return { ...data, elements }
}

export function curvePath2D(curve: Curve2D): string {
  const point = (p: Point2D) => `${p[0]} ${-p[1]}`
  const spans = cubicSpans(curve)
  const path = spans.length
    ? `M ${point(curve.points[0])} ` + spans.map(([, b, c, d]) => `C ${point(b)} ${point(c)} ${point(d)}`).join(' ')
    : curve.points.map((p, i) => `${i ? 'L' : 'M'} ${point(p)}`).join(' ')
  return path + (curve.closed ? ' Z' : '')
}
