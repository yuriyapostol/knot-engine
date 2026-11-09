import type { Curve2D, Curve3D, Point2D, Point3D } from './knot'

/** Authored points, including handles, for dimension checks and resource budgets. */
export function curveControlPoints(curve: Curve2D | Curve3D): (Point2D | Point3D)[] {
  if (!('segments' in curve)) return curve.points
  return [curve.start, ...curve.segments.flatMap<(Point2D | Point3D)>(s =>
    s.type === 'line' ? [s.end] : s.type === 'quadratic' ? [s.control, s.end] : [s.control1, s.control2, s.end])]
}
