import { describe, expect, it } from 'vitest'
import { Knot, configureLocalization, validateKnot, STANDARD_RESOURCES } from '../src/core'
import raw from '../v1/examples/knots/open-rope.json'

describe('prepared Knot model', () => {
  it('prepares, resolves resources and serializes without methods', () => {
    configureLocalization({ locale: 'uk', fallbackLocale: 'en' })
    const report = validateKnot(raw, { registries: [STANDARD_RESOURCES] })
    if (!report.valid) throw new Error('Validation diagnostic: ' + JSON.stringify(report.issues))
    const knot = Knot.from(raw as any, { registries: [STANDARD_RESOURCES] })
    const representation = knot.getRepresentation('view-3d-rest')!
    expect(representation).toBe(knot.representations?.[0])
    expect(representation.getTypeDefinition()?.getName()).toBe('Просторова крива')
    expect(representation.getName()).toBe('Просторова крива')
    expect(knot.toRaw().schema).toBe('Knot')
    expect(JSON.stringify(knot.toRaw())).not.toContain('getName')
    expect(validateKnot(knot, { registries: [STANDARD_RESOURCES] }).valid).toBe(true)
    expect(knot.clone().getRepresentation('view-3d-rest')).not.toBe(representation)
    configureLocalization({ locale: 'en' })
  })
  it('controls structural changes and preserves stable identity', () => {
    const knot = Knot.from(raw as any, { registries: [STANDARD_RESOURCES] })
    const existing = knot.getRepresentation('view-3d-rest')!
    expect(knot.getRepresentation('view-3d-rest')).toBe(existing)
    expect(() => knot.representations?.push(existing)).toThrow()
    const created = knot.addRepresentation({ id: 'new-representation', type: existing.type, data: existing.data })
    expect(knot.getRepresentation('new-representation')).toBe(created)
    expect(knot.removeRepresentation('new-representation')).toBe(true)
    expect(knot.getRepresentation('new-representation')).toBeUndefined()
  })
})
