import { expect, it } from 'vitest'
import overhand from '../v1/examples/assets/overhand.json'
import twistedLoop from '../v1/examples/assets/twisted-loop.json'
import { MOSAIC_DIAGRAM, SPATIAL_CURVE, expandURI, validateKnotAsset, validateMosaicDiagram, selectRepresentation, type KnotAsset } from '../src/core'

for (const fixture of [overhand, twistedLoop]) {
  const asset = fixture as unknown as KnotAsset
  it(`${asset.id} provides selectable, valid spatial and mosaic representations`, () => {
    expect(validateKnotAsset(asset)).toMatchObject({ valid: true, complete: true })
    expect(asset.representations).toHaveLength(2)
    const types = asset.representations!.map(rep => expandURI(rep.type, asset.namespaces))
    expect(types).toContain(SPATIAL_CURVE)
    expect(types).toContain(MOSAIC_DIAGRAM)
    for (const rep of asset.representations ?? []) {
      expect(selectRepresentation(asset, { representationId: rep.id })).toMatchObject({ ok: true })
    }
    const mosaic = asset.representations!.find(rep => expandURI(rep.type, asset.namespaces) === MOSAIC_DIAGRAM)!
    expect(validateMosaicDiagram(mosaic.data)).toMatchObject({ valid: true, componentCount: 1 })
  })
}
