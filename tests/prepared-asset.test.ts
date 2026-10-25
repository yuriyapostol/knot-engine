import { describe, expect, it } from 'vitest'
import { Asset, configureLocalization, validateAsset, STANDARD_RESOURCES } from '../src/core'
import raw from '../v1/examples/assets/open-rope.json'

describe('prepared Asset model', () => {
  it('prepares, resolves resources and serializes without methods', () => {
    configureLocalization({ locale: 'uk', fallbackLocale: 'en' })
    const asset = Asset.from(raw as any, { registries: [STANDARD_RESOURCES] })
    const representation = asset.getRepresentation('view-3d-rest')!
    expect(representation).toBe(asset.representations?.[0])
    expect(representation.getTypeDefinition()?.getName()).toBe('Просторова крива')
    expect(representation.getName()).toBe('Просторова крива')
    expect(asset.toRaw().schema).toBe('Asset')
    expect(JSON.stringify(asset.toRaw())).not.toContain('getName')
    expect(validateAsset(asset, { registries: [STANDARD_RESOURCES] }).valid).toBe(true)
    expect(asset.clone().getRepresentation('view-3d-rest')).not.toBe(representation)
    configureLocalization({ locale: 'en' })
  })
  it('controls structural changes and preserves stable identity', () => {
    const asset = Asset.from(raw as any, { registries: [STANDARD_RESOURCES] })
    const existing = asset.getRepresentation('view-3d-rest')!
    expect(asset.getRepresentation('view-3d-rest')).toBe(existing)
    expect(() => asset.representations?.push(existing)).toThrow()
    const created = asset.addRepresentation({ id: 'new-representation', type: existing.type, data: existing.data })
    expect(asset.getRepresentation('new-representation')).toBe(created)
    expect(asset.removeRepresentation('new-representation')).toBe(true)
    expect(asset.getRepresentation('new-representation')).toBeUndefined()
  })
})
