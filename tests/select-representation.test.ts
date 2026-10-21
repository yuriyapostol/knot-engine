import { describe, expect, it } from 'vitest'
import open from '../v1/examples/assets/open-rope.json'
import { selectRepresentation, SPATIAL_CURVE, MOSAIC_DIAGRAM, type KnotAsset } from '../src/core'

const copy = (): KnotAsset => structuredClone(open) as KnotAsset
describe('independent representation selection', () => {
  it('selects by type or explicit ID without changing input', () => {
    const asset = copy(), before = JSON.stringify(asset)
    const byType = selectRepresentation(asset, { type: SPATIAL_CURVE })
    expect(byType.ok).toBe(true)
    if (!byType.ok) return
    expect(byType.representation.type).toBe(SPATIAL_CURVE)
    expect(selectRepresentation(asset, { representationId: byType.representation.id })).toMatchObject({ ok: true })
    expect(JSON.stringify(asset)).toBe(before)
  })
  it('expands a declared prefix in the query', () => {
    const asset = copy()
    asset.namespaces = { ...asset.namespaces, test: 'https://yuriyapostol.github.io/knot-engine/v1/representation-types/' }
    expect(selectRepresentation(asset, { type: 'test:spatial-curve' })).toMatchObject({ ok: true, typeUri: SPATIAL_CURVE })
  })
  it('reports absent and mismatched types', () => {
    const asset = copy()
    expect(selectRepresentation(asset, { representationId: 'not-found' })).toMatchObject({
      ok: false, issues: [{ code: 'REPRESENTATION_NOT_FOUND' }],
    })
    expect(selectRepresentation(asset, { type: MOSAIC_DIAGRAM })).toMatchObject({
      ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION' }],
    })
  })
  it('reports ambiguity instead of silently taking the first match', () => {
    const asset = copy()
    asset.representations!.push({ ...structuredClone(asset.representations![0]), id: 'second-spatial' })
    expect(selectRepresentation(asset, { type: SPATIAL_CURVE })).toMatchObject({
      ok: false, issues: [{ code: 'AMBIGUOUS_REPRESENTATION' }],
    })
  })
  it('reports incomplete dependencies', () => {
    const asset = copy()
    asset.representationTypes = []
    expect(selectRepresentation(asset)).toMatchObject({
      ok: false, issues: [{ code: 'MISSING_DEPENDENCY' }],
    })
  })
  it('rejects malformed assets without throwing', () => {
    expect(selectRepresentation({ schema: 'KnotAsset' } as KnotAsset)).toMatchObject({
      ok: false, issues: [{ code: 'INVALID_ASSET' }],
    })
  })
})
