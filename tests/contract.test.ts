import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { KnotViewer, validateModel, resolveKnotModelV1, type KnotModelV1 } from '../src'
import { buildGeometry } from '../src/geometry/build'
import loop from '../examples/models/twisted-loop.json'

const model = loop as KnotModelV1
describe('model contract', () => {
  it('accepts the documented fixture without mutation', () => {
    const before = JSON.stringify(model)
    const result = validateModel(model, { strict: true })
    expect(result.valid).toBe(true)
    expect(JSON.stringify(model)).toBe(before)
  })
  it('reports duplicate curve IDs and unsupported schema with paths', () => {
    const duplicate = { ...model, curves: [model.curves[0], { ...model.curves[0] }] }
    const result = validateModel(duplicate)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some(issue => issue.path === 'curves[1].id')).toBe(true)
    const version = validateModel({ ...model, schemaVersion: 2 })
    expect(version.valid).toBe(false)
    if (!version.valid) expect(version.issues[0].code).toBe('UNSUPPORTED_SCHEMA')
  })
  it('applies a scale-aware duplicate threshold and point limit', () => {
    const near = { ...model, curves: [{ ...model.curves[0], points: [[3, -6, -1], [3 + 1e-10, -6, -1], ...model.curves[0].points.slice(1)] }] }
    const result = validateModel(near)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some(issue => issue.path === 'curves[0].points[1]')).toBe(true)
    const oversized = validateModel({ ...model, curves: [{ ...model.curves[0], points: Array.from({ length: 100000 }, (_, i) => [i, 0, 0]) }] })
    expect(oversized.valid).toBe(false)
    if (!oversized.valid) expect(oversized.issues.some(issue => issue.code === 'LIMIT_EXCEEDED')).toBe(true)
  })
  it('rejects repeated closed endpoints and bad camera', () => {
    const result = validateModel({ ...model, curves: [{ ...model.curves[0], points: [...model.curves[0].points, model.curves[0].points[0]] }], preview: { cameraPosition: [0, 0, 0], target: [0, 0, 0] } })
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.map(issue => issue.path)).toEqual(expect.arrayContaining(['curves[0].points[6]', 'preview.cameraPosition']))
  })
})
describe('rendering contracts', () => {
  it('builds finite geometry and disposes resources', () => {
    const built = buildGeometry(resolveKnotModelV1(model), 'medium', 'light')
    expect(built.bounds.isEmpty()).toBe(false)
    for (const mesh of built.group.children) {
      if (!('geometry' in mesh)) continue
      const positions = (mesh.geometry as import('three').BufferGeometry).attributes.position.array
      expect(Array.from(positions).every(Number.isFinite)).toBe(true)
    }
    built.dispose()
  })
  it('server renders a stable fallback without a DOM', async () => {
    const html = await renderToString(createSSRApp(KnotViewer, { model, label: 'Rope model' }))
    expect(html).toContain('Rope model')
    expect(html).toContain('knot-viewer__surface')
    expect(html).not.toContain('<canvas')
  })
})
