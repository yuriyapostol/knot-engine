import type { Geometry2DData, Curve2D } from '../core/knot'
export interface CrossingPosition { id: string; element: string; segment: number; t: number; x: number; y: number; over: boolean }
type Hit = { a: number; b: number; ta: number; tb: number; x: number; y: number }
const EPS = 1e-9
function intersections(a: Curve2D, b: Curve2D, same: boolean): Hit[] {
  const result: Hit[] = []
  const as = a.points.length - 1 + Number(a.closed), bs = b.points.length - 1 + Number(b.closed)
  for (let i = 0; i < as; i++) for (let j = 0; j < bs; j++) {
    if (same && (j <= i + 1 || (a.closed && i === 0 && j === as - 1))) continue
    const p = a.points[i], q = a.points[(i + 1) % a.points.length]
    const r = b.points[j], s = b.points[(j + 1) % b.points.length]
    const ux = q[0] - p[0], uy = q[1] - p[1], vx = s[0] - r[0], vy = s[1] - r[1]
    const den = ux * vy - uy * vx
    if (Math.abs(den) < EPS) continue
    const wx = r[0] - p[0], wy = r[1] - p[1]
    const ta = (wx * vy - wy * vx) / den, tb = (wx * uy - wy * ux) / den
    if (ta <= EPS || ta >= 1 - EPS || tb <= EPS || tb >= 1 - EPS) continue
    result.push({ a: i, b: j, ta, tb, x: p[0] + ta * ux, y: p[1] + ta * uy })
  }
  return result
}
/** Match ordered crossing passages to geometric intersections of polyline curves. */
export function locateCrossings(data: Geometry2DData): CrossingPosition[] {
  const curves = data.elements.filter(e => e.type === 'curve')
  if (curves.some(c => c.interpolation.type !== 'polyline')) throw new Error('2D crossing location currently supports polyline interpolation only')
  const passages = data.crossings ?? []
  const hits: Array<{ idA: string; idB: string; hit: Hit }> = []
  const segments = curves.reduce((n, c) => n + c.points.length - 1 + Number(c.closed), 0)
  if (segments > 2048) throw new Error('Too many 2D segments for crossing detection')
  for (let i = 0; i < curves.length; i++) for (let j = i; j < curves.length; j++) {
    for (const hit of intersections(curves[i], curves[j], i === j)) hits.push({ idA: curves[i].id, idB: curves[j].id, hit })
  }
  const visits = new Map<string, Array<{ hitIndex: number; segment: number; t: number }>>()
  hits.forEach((entry, index) => {
    for (const [id, segment, t] of [[entry.idA, entry.hit.a, entry.hit.ta], [entry.idB, entry.hit.b, entry.hit.tb]] as const)
      visits.set(id, [...(visits.get(id) ?? []), { hitIndex: index, segment, t }])
  })
  for (const list of visits.values()) list.sort((a, b) => a.segment - b.segment || a.t - b.t)
  const cursors = new Map<string, number>(), positions: CrossingPosition[] = []
  const paired = new Map<string, number>()
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
    paired.set(passage.id, visit.hitIndex)
    positions.push({ id: passage.id, element: passage.element, segment: visit.segment, t: visit.t, x: hit.hit.x, y: hit.hit.y, over: 'underElement' in passage })
    cursors.set(passage.element, cursor + 1)
  }
  if (positions.length !== hits.length * 2) throw new Error('Crossing records do not match all geometric intersections')
  return positions
}
