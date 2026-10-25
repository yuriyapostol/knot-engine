import { describe, expect, it } from 'vitest'
import open from '../v1/examples/knots/open-rope.json'
import { createViewerRegistry, selectViewerRepresentation } from '../src/components/viewerRegistry'
import { SPATIAL_CURVE, MOSAIC_DIAGRAM, type RawKnot } from '../src/core'
import type { Component } from 'vue'

const component = {} as Component
const registry = createViewerRegistry([
  { typeUri: SPATIAL_CURVE, component, capabilities: { zoom: true } },
  { typeUri: MOSAIC_DIAGRAM, component, capabilities: { zoom: true } },
])
const copy = () => structuredClone(open) as unknown as RawKnot
describe('generic viewer dispatch', () => {
  it('selects a unique supported representation despite an unsupported sibling', () => {
    const knot = copy()
    knot.representations!.push({ id: 'unknown', type: 'urn:example:future', data: {} })
    const before = JSON.stringify(knot)
    const result = selectViewerRepresentation(knot, registry)
    expect(result).toMatchObject({ ok: true, typeUri: SPATIAL_CURVE })
    expect(JSON.stringify(knot)).toBe(before)
  })
  it('rejects multiple supported candidates without a priority rule', () => {
    const knot = copy()
    knot.representations!.push({ ...structuredClone(knot.representations![0]), id: 'another' })
    expect(selectViewerRepresentation(knot, registry)).toMatchObject({
      ok: false, issues: [{ code: 'AMBIGUOUS_REPRESENTATION' }],
    })
    expect(selectViewerRepresentation(knot, registry, 'another')).toMatchObject({ ok: true })
  })
  it('rejects unsupported-only knots and explicit unsupported IDs', () => {
    const knot = copy()
    knot.representations!.push({ id: 'future', type: 'urn:example:future', data: {} })
    const onlyUnknown = { ...knot, representations: [knot.representations![1]] }
    expect(selectViewerRepresentation(onlyUnknown, registry)).toMatchObject({
      ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION' }],
    })
    expect(selectViewerRepresentation(knot, registry, 'future')).toMatchObject({ ok: false })
    expect(registry.has('urn:example:future')).toBe(false)
  })
  it('uses an explicitly provided registry as authoritative', () => {
    const knot = copy()
    const empty = createViewerRegistry([])
    expect(selectViewerRepresentation(knot, empty)).toMatchObject({
      ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION' }],
    })
  })
  it('preserves core validation for invalid selected data', () => {
    const knot = copy()
    knot.representations![0].data = {}
    expect(selectViewerRepresentation(knot, registry)).toMatchObject({ ok: false })
  })
})
