import { describe, expect, it } from 'vitest'
import { resolveRepresentationView, type KnotResourceRegistry, type ViewDefinition } from '../src/core'

const plane: ViewDefinition = { id: 'urn:test:view', name: 'Plane', space: 'plane', camera: { mode: 'plane', center: [2,2], height: 4 } }
const registry: KnotResourceRegistry = {
  schema: 'KnotResourceRegistry', schemaVersion: 1,
  resources: [{ kind: 'view', resource: plane }],
}
describe('application view resolution', () => {
  it('does not choose a view without an explicit request', () => {
    expect(resolveRepresentationView(undefined, [plane], [registry])).toEqual({ ok: true, view: null })
  })
  it('resolves external views from explicitly supplied registries', () => {
    expect(resolveRepresentationView({ ref: 'urn:test:view' }, [], [registry])).toMatchObject({ ok: true, view: plane })
  })
  it('reports missing registry resources instead of fetching', () => {
    expect(resolveRepresentationView({ ref: 'urn:test:view' })).toMatchObject({ ok: false, message: 'Missing view resource: urn:test:view' })
  })
  it('supports local application presets and inline overrides', () => {
    const local = { ...plane, id: 'local' }
    expect(resolveRepresentationView({ id: 'local' }, [local])).toMatchObject({ ok: true, view: local })
    expect(resolveRepresentationView(local)).toMatchObject({ ok: true, view: local })
    expect(resolveRepresentationView({ id: 'missing' }, [local])).toMatchObject({ ok: false })
  })
  it('rejects duplicate local preset IDs', () => {
    expect(resolveRepresentationView({ id: 'local' }, [{ ...plane, id: 'local' }, { ...plane, id: 'local' }])).toMatchObject({ ok: false, message: 'Ambiguous local view: local' })
  })
  it('does not mutate caller-owned views or registries', () => {
    const before = JSON.stringify([plane, registry])
    resolveRepresentationView({ ref: 'urn:test:view' }, [plane], [registry])
    expect(JSON.stringify([plane, registry])).toBe(before)
  })
})
