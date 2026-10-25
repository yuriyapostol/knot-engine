import { describe, expect, it } from 'vitest'
import open from '../v1/examples/knots/open-rope.json'
import { selectRepresentation, SPATIAL_CURVE, MOSAIC_DIAGRAM, type RawKnot } from '../src/core'

const copy = (): RawKnot => structuredClone(open) as unknown as RawKnot
describe('independent representation selection', () => {
  it('selects by type or explicit ID without changing input', () => {
    const knot = copy(), before = JSON.stringify(knot)
    const byType = selectRepresentation(knot, { type: SPATIAL_CURVE })
    expect(byType.ok).toBe(true)
    if (!byType.ok) return
    expect(byType.representation.type).toBe(SPATIAL_CURVE)
    expect(selectRepresentation(knot, { representationId: byType.representation.id })).toMatchObject({ ok: true })
    expect(JSON.stringify(knot)).toBe(before)
  })
  it('expands a declared prefix in the query', () => {
    const knot = copy()
    knot.namespaces = { ...knot.namespaces, test: 'https://yuriyapostol.github.io/knot-engine/v1/representation-types/' }
    expect(selectRepresentation(knot, { type: 'test:spatial-curve' })).toMatchObject({ ok: true, typeUri: SPATIAL_CURVE })
  })
  it('reports absent and mismatched types', () => {
    const knot = copy()
    expect(selectRepresentation(knot, { representationId: 'not-found' })).toMatchObject({
      ok: false, issues: [{ code: 'REPRESENTATION_NOT_FOUND' }],
    })
    expect(selectRepresentation(knot, { type: MOSAIC_DIAGRAM })).toMatchObject({
      ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION' }],
    })
  })
  it('reports ambiguity instead of silently taking the first match', () => {
    const knot = copy()
    knot.representations!.push({ ...structuredClone(knot.representations![0]), id: 'second-spatial' })
    expect(selectRepresentation(knot, { type: SPATIAL_CURVE })).toMatchObject({
      ok: false, issues: [{ code: 'AMBIGUOUS_REPRESENTATION' }],
    })
  })
  it('reports incomplete dependencies', () => {
    const knot = copy()
    knot.representationTypes = []
    expect(selectRepresentation(knot)).toMatchObject({
      ok: false, issues: [{ code: 'MISSING_DEPENDENCY' }],
    })
  })
  it('rejects malformed knots without throwing', () => {
    expect(selectRepresentation({ schema: 'Knot' } as RawKnot)).toMatchObject({
      ok: false, issues: [{ code: 'INVALID_KNOT' }],
    })
  })
})

describe('targeted validation', () => {
  it('ignores unrelated unsupported representations but preserves them in the result', () => {
    const knot = copy()
    knot.representations!.push({ id: 'future', type: 'urn:example:future', data: { value: 1 } })
    const selected = selectRepresentation(knot, { type: SPATIAL_CURVE })
    expect(selected).toMatchObject({ ok: true, typeUri: SPATIAL_CURVE })
    if (selected.ok) expect(selected.knot.representations).toHaveLength(2)
    const full = selectRepresentation(knot, { type: SPATIAL_CURVE }, { scope: 'all' })
    expect(full.ok).toBe(false)
    if (!full.ok) expect(full.issues.some(issue => issue.code === 'MISSING_DEPENDENCY')).toBe(true)
  })
  it('validates selected data even if unrelated representation data is invalid', () => {
    const knot = copy()
    knot.representations!.push({ id: 'broken', type: SPATIAL_CURVE, data: {} })
    expect(selectRepresentation(knot, { representationId: 'view-3d-rest' })).toMatchObject({ ok: true })
    const broken = selectRepresentation(knot, { representationId: 'broken' })
    expect(broken.ok).toBe(false)
    if (!broken.ok) expect(broken.issues.some(issue => issue.code === 'INVALID_REPRESENTATION')).toBe(true)
  })
  it('does not require unrelated procedures to validate the selected representation', () => {
    const knot = copy()
    knot.procedures = [{ id: 'future-steps', steps: [{ id: 'step', representations: [{ id: 'missing' }] }] }]
    expect(selectRepresentation(knot, { type: SPATIAL_CURVE })).toMatchObject({ ok: true })
    expect(selectRepresentation(knot, { type: SPATIAL_CURVE }, { scope: 'all' })).toMatchObject({ ok: false })
  })
  it('still checks the selected construction and object references', () => {
    const knot = copy()
    knot.constructions = []
    expect(selectRepresentation(knot, { type: SPATIAL_CURVE })).toMatchObject({ ok: false })
  })
})

describe('scoped spatial resolution', () => {
  it('ignores unrelated unsupported sibling while preserving strict default', async () => {
    const { resolveKnot } = await import('../src/core')
    const knot = copy()
    knot.representations!.push({ id: 'future', type: 'urn:example:future', data: {} })
    expect(() => resolveKnot(knot, { representationId: 'view-3d-rest' })).toThrow()
    expect(resolveKnot(knot, { representationId: 'view-3d-rest' }, { scope: 'selected' }).curves.length).toBeGreaterThan(0)
  })
  it('rejects invalid selected data', async () => {
    const { resolveKnot } = await import('../src/core')
    const knot = copy()
    knot.representations![0].data = {}
    expect(() => resolveKnot(knot, { representationId: knot.representations![0].id }, { scope: 'selected' })).toThrow()
  })
})
