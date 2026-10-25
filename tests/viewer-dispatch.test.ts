import { describe, expect, it } from 'vitest'
import open from '../v1/examples/assets/open-rope.json'
import { createViewerRegistry, selectViewerRepresentation } from '../src/components/viewerRegistry'
import { SPATIAL_CURVE, MOSAIC_DIAGRAM, type RawAsset } from '../src/core'
import type { Component } from 'vue'

const component = {} as Component
const registry = createViewerRegistry([
  { typeUri: SPATIAL_CURVE, component, capabilities: { zoom: true } },
  { typeUri: MOSAIC_DIAGRAM, component, capabilities: { zoom: true } },
])
const copy = () => structuredClone(open) as unknown as RawAsset
describe('generic viewer dispatch', () => {
  it('selects a unique supported representation despite an unsupported sibling', () => {
    const asset = copy()
    asset.representations!.push({ id: 'unknown', type: 'urn:example:future', data: {} })
    const before = JSON.stringify(asset)
    const result = selectViewerRepresentation(asset, registry)
    expect(result).toMatchObject({ ok: true, typeUri: SPATIAL_CURVE })
    expect(JSON.stringify(asset)).toBe(before)
  })
  it('rejects multiple supported candidates without a priority rule', () => {
    const asset = copy()
    asset.representations!.push({ ...structuredClone(asset.representations![0]), id: 'another' })
    expect(selectViewerRepresentation(asset, registry)).toMatchObject({
      ok: false, issues: [{ code: 'AMBIGUOUS_REPRESENTATION' }],
    })
    expect(selectViewerRepresentation(asset, registry, 'another')).toMatchObject({ ok: true })
  })
  it('rejects unsupported-only assets and explicit unsupported IDs', () => {
    const asset = copy()
    asset.representations!.push({ id: 'future', type: 'urn:example:future', data: {} })
    const onlyUnknown = { ...asset, representations: [asset.representations![1]] }
    expect(selectViewerRepresentation(onlyUnknown, registry)).toMatchObject({
      ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION' }],
    })
    expect(selectViewerRepresentation(asset, registry, 'future')).toMatchObject({ ok: false })
    expect(registry.has('urn:example:future')).toBe(false)
  })
  it('uses an explicitly provided registry as authoritative', () => {
    const asset = copy()
    const empty = createViewerRegistry([])
    expect(selectViewerRepresentation(asset, empty)).toMatchObject({
      ok: false, issues: [{ code: 'UNSUPPORTED_REPRESENTATION' }],
    })
  })
  it('preserves core validation for invalid selected data', () => {
    const asset = copy()
    asset.representations![0].data = {}
    expect(selectViewerRepresentation(asset, registry)).toMatchObject({ ok: false })
  })
})
