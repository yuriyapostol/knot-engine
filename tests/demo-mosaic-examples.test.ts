import { validateKnot } from '../src/core/validateKnot'
import { expect, it } from 'vitest'
import overhand from '../v1/examples/knots/overhand.json'
import twistedLoop from '../v1/examples/knots/twisted-loop.json'
import { normalizeKnot } from '../src/core/validateKnot'
import { MOSAIC_DIAGRAM, GEOMETRY_3D, GEOMETRY_2D, expandURI, validateMosaicDiagram, selectRepresentation, type RawKnot, type Geometry2DData } from '../src/core'
import { locateCrossings } from '../src/components/geometry2d'
import { flattenGeometry2D } from '../src/components/curves2d'

for (const fixture of [overhand, twistedLoop]) {
  const knot = fixture as unknown as RawKnot
  it(`${knot.id} provides selectable, valid demo representations`, () => {
    expect(validateKnot(knot)).toMatchObject({ valid: true, complete: true })
    expect(knot.representations).toHaveLength(knot.id === 'overhand' ? 4 : 3)
    const types = knot.representations!.map(rep => expandURI(rep.type, knot.namespaces))
    expect(types).toContain(GEOMETRY_3D)
    expect(types).toContain(MOSAIC_DIAGRAM)
    expect(types).toContain(GEOMETRY_2D)
    for (const rep of knot.representations ?? []) {
      expect(selectRepresentation(knot, { representationId: rep.id })).toMatchObject({ ok: true })
    }
    const mosaic = knot.representations!.find(rep => expandURI(rep.type, knot.namespaces) === MOSAIC_DIAGRAM)!
    expect(validateMosaicDiagram(normalizeKnot(knot).representations!.find(rep => rep.id === mosaic.id)!.data)).toMatchObject({ valid: true, componentCount: 1 })
  })
}

it('provides a classic symmetric trefoil with only three cubic Bezier segments', () => {
  const representation = overhand.representations.find(rep => rep.id === 'view-2d-closed')!
  const closed = representation.data as Geometry2DData
  expect(closed.elements).toHaveLength(1)
  expect(closed.elements[0].closed).toBe(true)
  const curve = closed.elements[0]
  if (!('segments' in curve)) throw new Error('Expected a segmented Bezier curve')
  expect(curve.segments).toHaveLength(3)
  expect(curve.segments.every(s => s.type === 'cubic')).toBe(true)
  // The three anchors and all handles repeat under a 120-degree rotation.
  const rotate = ([x, y]: number[]) => [-x / 2 + Math.sqrt(3) * y / 2, -Math.sqrt(3) * x / 2 - y / 2]
  const close = (a: number[], b: number[]) => a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 7))
  close(rotate(curve.start), curve.segments[0].end)
  for (const [i, segment] of curve.segments.entries()) {
    const next = curve.segments[(i + 1) % 3]
    if (segment.type !== 'cubic' || next.type !== 'cubic') throw new Error('Expected cubic segments')
    close(rotate(segment.control1), next.control1)
    close(rotate(segment.control2), next.control2)
    close(rotate(segment.end), next.end)
  }
  expect(representation).not.toHaveProperty('target')
  const visits = locateCrossings(closed)
  expect(visits).toHaveLength(6)
  expect(new Set(visits.map(p => p.id)).size).toBe(3)
  expect(visits.map(p => p.over)).toEqual([false, true, false, true, false, true])
  const points = flattenGeometry2D(closed).elements[0].points
  const signs = [...new Set(visits.map(p => p.id))].map(id => {
    const tangent = (over: boolean) => {
      const p = visits.find(p => p.id === id && p.over === over)!, a = points[p.segment], b = points[(p.segment + 1) % points.length]
      return [b[0] - a[0], b[1] - a[1]]
    }
    const a = tangent(true), b = tangent(false)
    return Math.sign(a[0] * b[1] - a[1] * b[0])
  })
  expect(Math.abs(signs.reduce((sum, s) => sum + s, 0))).toBe(3)
})
