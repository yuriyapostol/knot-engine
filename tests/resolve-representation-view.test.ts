import { describe, expect, it } from 'vitest'
import open from '../v1/examples/assets/open-rope.json'
import { resolveRepresentationView, type KnotAsset, type KnotResourceRegistry, type ViewDefinition } from '../src/core'

const plane: ViewDefinition = { id: 'urn:test:view', name: 'Plane', space: 'plane', camera: { mode: 'plane', center: [2,2], height: 4, rotation: 0 } }
const registry: KnotResourceRegistry = {
  schema: 'KnotResourceRegistry', schemaVersion: 1,
  resources: [{ kind: 'view', resource: plane }],
}
const make = () => {
  const asset = structuredClone(open) as unknown as KnotAsset
  const rep = asset.representations![0]
  rep.views = [{ ref: 'urn:test:view' }]
  rep.defaultView = { ref: 'urn:test:view' }
  return { asset, rep }
}
describe('representation view resolution', () => {
  it('resolves a declared external view from a supplied registry', () => {
    const { asset, rep } = make()
    expect(resolveRepresentationView(asset, rep, undefined, [registry])).toMatchObject({ ok: true, view: plane })
  })
  it('reports missing registry resources instead of fetching', () => {
    const { asset, rep } = make()
    expect(resolveRepresentationView(asset, rep, undefined)).toMatchObject({ ok: false, message: 'Missing view resource: urn:test:view' })
  })
  it('rejects undeclared external views', () => {
    const { asset, rep } = make()
    expect(resolveRepresentationView(asset, rep, { ref: 'urn:test:other' }, [registry])).toMatchObject({ ok: false })
  })
  it('supports inline local views and explicit override', () => {
    const { asset, rep } = make()
    const local = { ...plane, id: 'local' }
    rep.views = [local]
    expect(resolveRepresentationView(asset, rep, { id: 'local' })).toMatchObject({ ok: true, view: local })
    expect(resolveRepresentationView(asset, rep, local)).toMatchObject({ ok: true, view: local })
  })
  it('does not mutate asset or registry', () => {
    const { asset, rep } = make()
    const before = JSON.stringify([asset, registry])
    resolveRepresentationView(asset, rep, undefined, [registry])
    expect(JSON.stringify([asset, registry])).toBe(before)
  })
})
