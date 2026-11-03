import type { Geometry2DData, InterpolatedCurve2D as Curve2D, Point2D } from '../core/knot'
import { flattenGeometry2D } from './curves2d'
export interface CrossingPosition { id: string; element: string; segment: number; t: number; x: number; y: number; over: boolean }
type Hit = { a: number; b: number; ta: number; tb: number; x: number; y: number }
const EPS = 1e-9
function passageRays(curve: Curve2D, segment: number, t: number, x: number, y: number): Point2D[] {
  const n = curve.points.length
  let before = curve.points[segment], after = curve.points[(segment + 1) % n]
  if (t <= EPS) {
    if (!curve.closed && segment === 0) throw new Error('2D endpoint contacts are not supported')
    before = curve.points[(segment - 1 + n) % n]
  } else if (t >= 1 - EPS) {
    if (!curve.closed && segment + 1 === n - 1) throw new Error('2D endpoint contacts are not supported')
    after = curve.points[(segment + 2) % n]
  }
  return [before, after].map(p => [p[0] - x, p[1] - y])
}
function transverse(a: Curve2D, b: Curve2D, hit: Hit) {
  const rays = [passageRays(a, hit.a, hit.ta, hit.x, hit.y), passageRays(b, hit.b, hit.tb, hit.x, hit.y)]
    .flatMap((points, owner) => points.map(p => ({ angle: Math.atan2(p[1], p[0]), owner })))
    .sort((a, b) => a.angle - b.angle)
  for (let i = 0; i < 4; i++) {
    const next = rays[(i + 1) % 4]
    const angle = (next.angle - rays[i].angle + Math.PI * 2) % (Math.PI * 2)
    if (angle < EPS || rays[i].owner === next.owner) throw new Error('2D tangencies or ambiguous intersections are not supported')
  }
}
function intersections(a: Curve2D, b: Curve2D, same: boolean): Hit[] {
  const result: Hit[] = []
  const as = a.points.length - 1 + Number(a.closed), bs = b.points.length - 1 + Number(b.closed)
  const canonical = (segment: number, t: number, count: number, closed: boolean) => {
    const value = segment + (Math.abs(t) <= EPS ? 0 : Math.abs(t - 1) <= EPS ? 1 : t)
    return closed && Math.abs(value - count) <= EPS ? 0 : value
  }
  const seen = new Set<string>()
  for (let i = 0; i < as; i++) for (let j = 0; j < bs; j++) {
    if (same && (j <= i + 1 || (a.closed && i === 0 && j === as - 1))) continue
    const p = a.points[i], q = a.points[(i + 1) % a.points.length]
    const r = b.points[j], s = b.points[(j + 1) % b.points.length]
    // Bounding-box rejection also keeps densely subdivided splines inexpensive.
    if (Math.max(p[0], q[0]) + EPS < Math.min(r[0], s[0]) || Math.max(r[0], s[0]) + EPS < Math.min(p[0], q[0]) ||
        Math.max(p[1], q[1]) + EPS < Math.min(r[1], s[1]) || Math.max(r[1], s[1]) + EPS < Math.min(p[1], q[1])) continue
    const ux = q[0] - p[0], uy = q[1] - p[1], vx = s[0] - r[0], vy = s[1] - r[1]
    const den = ux * vy - uy * vx, lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy)
    const wx = r[0] - p[0], wy = r[1] - p[1]
    if (Math.abs(den) <= EPS * lengths) {
      if (Math.abs(wx * uy - wy * ux) <= EPS * Math.hypot(ux, uy)) throw new Error('2D overlapping spans or collinear contacts are not supported')
      continue
    }
    const ta = (wx * vy - wy * vx) / den, tb = (wx * uy - wy * ux) / den
    if (ta < -EPS || ta > 1 + EPS || tb < -EPS || tb > 1 + EPS) continue
    const ca = canonical(i, ta, as, a.closed), cb = canonical(j, tb, bs, b.closed)
    // Adjacent sampled segments can report the same vertex hit with slightly
    // different floating-point parameters on the other branch. Segment/vertex
    // identities deduplicate these without rounding away nearby intersections.
    const keyA = Number.isInteger(ca) ? `v${ca}` : `s${i}`
    const keyB = Number.isInteger(cb) ? `v${cb}` : `s${j}`
    const key = same && ca > cb ? `${keyB}:${keyA}` : `${keyA}:${keyB}`
    if (seen.has(key)) continue
    const hit = { a: i, b: j, ta, tb, x: p[0] + ta * ux, y: p[1] + ta * uy }
    transverse(a, b, hit)
    seen.add(key); result.push(hit)
    if (result.length > 4096) throw new Error('Too many 2D intersections')
  }
  return result
}
/** Match ordered passages to transverse intersections; splines use bounded subdivision. */
export function locateCrossings(data: Geometry2DData): CrossingPosition[] {
  const flattened = flattenGeometry2D(data)
  const points = flattened.elements.flatMap(e => e.points)
  const xs = points.map(p => p[0]), ys = points.map(p => p[1])
  const minX = Math.min(...xs), minY = Math.min(...ys)
  const extent = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)
  // Relative coordinates make intersection tolerances independent of physical units.
  const curves = flattened.elements.map(c => ({ ...c, points: c.points.map(p => [(p[0] - minX) / extent, (p[1] - minY) / extent] as Point2D) }))
  for (const curve of curves) {
    for (let i = curve.closed ? 0 : 1; i < curve.points.length - Number(!curve.closed); i++) {
      const previous = curve.points[(i - 1 + curve.points.length) % curve.points.length], p = curve.points[i], next = curve.points[(i + 1) % curve.points.length]
      const ax = p[0] - previous[0], ay = p[1] - previous[1], bx = next[0] - p[0], by = next[1] - p[1]
      if (Math.abs(ax * by - ay * bx) <= EPS * Math.hypot(ax, ay) * Math.hypot(bx, by) && ax * bx + ay * by < 0)
        throw new Error('2D overlapping adjacent spans are not supported')
    }
  }
  const passages = data.crossings ?? []
  const hits: Array<{ idA: string; idB: string; hit: Hit }> = []
  const segments = curves.reduce((n, c) => n + c.points.length - 1 + Number(c.closed), 0)
  if (segments > 2048) throw new Error('Too many 2D segments for crossing detection')
  for (let i = 0; i < curves.length; i++) for (let j = i; j < curves.length; j++) {
    for (const hit of intersections(curves[i], curves[j], i === j)) {
      hits.push({ idA: curves[i].id, idB: curves[j].id, hit })
      if (hits.length > 4096) throw new Error('Too many 2D intersections')
    }
  }
  for (let i = 0; i < hits.length; i++) for (let j = 0; j < i; j++) {
    if (Math.hypot(hits[i].hit.x - hits[j].hit.x, hits[i].hit.y - hits[j].hit.y) <= EPS)
      throw new Error('2D multiple intersections at the same position are ambiguous')
  }
  const visits = new Map<string, Array<{ hitIndex: number; segment: number; t: number }>>()
  hits.forEach((entry, index) => {
    for (const [id, segment, t] of [[entry.idA, entry.hit.a, entry.hit.ta], [entry.idB, entry.hit.b, entry.hit.tb]] as const)
      visits.set(id, [...(visits.get(id) ?? []), { hitIndex: index, segment, t }])
  })
  for (const list of visits.values()) list.sort((a, b) => a.segment - b.segment || a.t - b.t)
  const cursors = new Map<string, number>(), positions: CrossingPosition[] = []
  const paired = new Map<string, number>()
  const hitIds = new Map<number, string>()
  for (const passage of passages) {
    const list = visits.get(passage.element) ?? [], cursor = cursors.get(passage.element) ?? 0
    const visit = list[cursor]
    if (!visit) throw new Error(`No geometric intersection for crossing ${passage.id} on ${passage.element}`)
    const hit = hits[visit.hitIndex]
    const other = hit.idA === passage.element ? hit.idB : hit.idA
    const expected = 'underElement' in passage ? passage.underElement : passage.overElement
    if (expected !== other) throw new Error(`Crossing ${passage.id} does not match geometric intersection`)
    const prior = paired.get(passage.id)
    if (prior !== undefined && prior !== visit.hitIndex) throw new Error(`Crossing ${passage.id} pairs different intersections`)
    const previousId = hitIds.get(visit.hitIndex)
    if (previousId !== undefined && previousId !== passage.id) throw new Error(`Geometric intersection has inconsistent crossing IDs: ${previousId}, ${passage.id}`)
    hitIds.set(visit.hitIndex, passage.id)
    paired.set(passage.id, visit.hitIndex)
    positions.push({ id: passage.id, element: passage.element, segment: visit.segment, t: visit.t, x: minX + hit.hit.x * extent, y: minY + hit.hit.y * extent, over: 'underElement' in passage })
    cursors.set(passage.element, cursor + 1)
  }
  if (positions.length !== hits.length * 2) throw new Error('Crossing records do not match all geometric intersections')
  return positions
}
