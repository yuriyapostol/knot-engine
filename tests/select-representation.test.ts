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

describe('targeted validation', () => {
  it('ignores unrelated unsupported representations but preserves them in the result', () => {
    const asset = copy()
    asset.representations!.push({ id: 'future', type: 'urn:example:future', data: { value: 1 } })
    const selected = selectRepresentation(asset, { type: SPATIAL_CURVE })
    expect(selected).toMatchObject({ ok: true, typeUri: SPATIAL_CURVE })
    if (selected.ok) expect(selected.asset.representations).toHaveLength(2)
    expect(selectRepresentation(asset, { type: SPATIAL_CURVE }, { scope: 'all' })).toMatchObject({
      ok: false, issues: [{ code: 'MISSING_DEPENDENCY' }],
    })
  })
  it('validates selected data even if unrelated representation data is invalid', () => {
    const asset = copy()
    asset.representations!.push({ id: 'broken', type: SPATIAL_CURVE, data: {} })
    expect(selectRepresentation(asset, { representationId: 'view-3d-rest' })).toMatchObject({ ok: true })
    expect(selectRepresentation(asset, { representationId: 'broken' })).toMatchObject({
      ok: false, issues: [{ code: 'INVALID_REPRESENTATION' }],
    })
  })
  it('does not require unrelated procedures to validate the selected representation', () => {
    const asset = copy()
    asset.procedures = [{ id: 'future-steps', steps: [{ id: 'step', representations: [{ id: 'missing' }] }] }]
    expect(selectRepresentation(asset, { type: SPATIAL_CURVE })).toMatchObject({ ok: true })
    expect(selectRepresentation(asset, { type: SPATIAL_CURVE }, { scope: 'all' })).toMatchObject({ ok: false })
  })
  it('still checks the selected construction and object references', () => {
    const asset = copy()
    asset.constructions = []
    expect(selectRepresentation(asset, { type: SPATIAL_CURVE })).toMatchObject({ ok: false })
  })
})
