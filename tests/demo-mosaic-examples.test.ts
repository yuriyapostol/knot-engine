import { expect, it } from 'vitest'
import overhand from '../v1/examples/knots/overhand.json'
import twistedLoop from '../v1/examples/knots/twisted-loop.json'
import { normalizeKnot } from '../src/core/validateKnot'
import { MOSAIC_DIAGRAM, SPATIAL_CURVE, expandURI, validateKnot, validateMosaicDiagram, selectRepresentation, type RawKnot } from '../src/core'

for (const fixture of [overhand, twistedLoop]) {
  const knot = fixture as unknown as RawKnot
  it(`${knot.id} provides selectable, valid spatial and mosaic representations`, () => {
    expect(validateKnot(knot)).toMatchObject({ valid: true, complete: true })
    expect(knot.representations).toHaveLength(2)
    const types = knot.representations!.map(rep => expandURI(rep.type, knot.namespaces))
    expect(types).toContain(SPATIAL_CURVE)
    expect(types).toContain(MOSAIC_DIAGRAM)
    for (const rep of knot.representations ?? []) {
      expect(selectRepresentation(knot, { representationId: rep.id })).toMatchObject({ ok: true })
    }
    const mosaic = knot.representations!.find(rep => expandURI(rep.type, knot.namespaces) === MOSAIC_DIAGRAM)!
    expect(validateMosaicDiagram(normalizeKnot(knot).representations!.find(rep => rep.id === mosaic.id)!.data)).toMatchObject({ valid: true, componentCount: 1 })
  })
}
