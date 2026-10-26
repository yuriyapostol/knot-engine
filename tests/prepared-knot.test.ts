import { validateKnot } from '../src/core/validateKnot'
import { describe, expect, it } from 'vitest'
import { Knot, configureLocalization, subscribeLocalization, STANDARD_RESOURCES } from '../src/core'
import raw from '../v1/examples/knots/open-rope.json'

describe('prepared Knot model', () => {
  it('notifies localization subscribers and supports cleanup', () => {
    let notifications = 0
    const unsubscribe = subscribeLocalization(() => { notifications++ })
    configureLocalization({ locale: 'uk' })
    expect(notifications).toBe(1)
    unsubscribe()
    configureLocalization({ locale: 'en' })
    expect(notifications).toBe(1)
  })
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
  it('supports per-knot locale and overrides without changing global locale or raw JSON', () => {
    configureLocalization({ locale: 'en', fallbackLocale: 'en' })
    const uri = 'https://yuriyapostol.github.io/knot-engine/v1/representation-types/spatial-curve'
    const knot = Knot.from(raw as any, { registries: [STANDARD_RESOURCES], locale: 'uk', overrides: {
      'view-3d-rest': { names: [{ language: 'uk', value: 'Мій вигляд' }] },
      [uri]: { names: [{ language: 'uk', value: 'Мій тип' }] },
    } })
    const rep = knot.getRepresentation('view-3d-rest')!
    expect(rep.getName()).toBe('Мій вигляд')
    expect(rep.getTypeDefinition()?.getName()).toBe('Мій тип')
    expect(rep.getName('en')).toBe('Spatial curve')
    expect(knot.clone().getRepresentation('view-3d-rest')?.getName()).toBe('Мій вигляд')
    expect(knot.select({ representations: ['view-3d-rest'] }).getRepresentation('view-3d-rest')?.getName()).toBe('Мій вигляд')
    expect(knot.toRaw()).toEqual(raw)
    const other = Knot.from(raw as any, { registries: [STANDARD_RESOURCES] })
    expect(other.getRepresentation('view-3d-rest')?.getName()).toBe('Spatial curve')
  })
  it('edits procedures and steps without replacing unrelated entities', () => {
    const knot = Knot.from(raw as any)
    const rep = knot.getRepresentation('view-3d-rest')
    const procedure = knot.addProcedure({ id: 'tie', steps: [{ id: 'first' }] })
    expect(knot.getProcedure('tie')).toBe(procedure)
    expect(procedure.getStep('first')).toBe(procedure.steps[0])
    expect(() => procedure.steps.push(procedure.steps[0])).toThrow()
    const step = procedure.addStep({ id: 'second' })
    expect(procedure.getStep('second')).toBe(step)
    expect(() => procedure.addStep({ id: 'second' })).toThrow()
    expect(procedure.removeStep('first')).toBe(true)
    expect(knot.getRepresentation('view-3d-rest')).toBe(rep)
    expect(knot.toRaw().procedures?.[0].steps.map(x => x.id)).toEqual(['second'])
    expect(knot.removeProcedure('tie')).toBe(true)
    expect(knot.getProcedure('tie')).toBeUndefined()
  })
  it('edits inline resource definitions without losing unrelated prepared references', () => {
    const knot = Knot.from(raw as any, { registries: [STANDARD_RESOURCES] })
    const original = knot.getRepresentation('view-3d-rest')!
    const type = original.getTypeDefinition()
    const id = 'https://example.org/types/experimental'
    const added = knot.addResourceDefinition('representationTypes', {
      id, name: 'Experimental', description: 'Test type',
      specification: 'https://example.org/spec', dataSchema: { inline: { $schema: 'https://json-schema.org/draft/2020-12/schema' } },
    })
    expect(knot.getResource(id)).toBe(added)
    expect(knot.getRepresentation('view-3d-rest')).toBe(original)
    expect(original.getTypeDefinition()).toBe(type)
    expect(() => knot.representationTypes?.push(knot.representationTypes[0])).toThrow()
    knot.addRepresentation({ id: 'experimental', type: id, data: {} })
    expect(() => knot.removeResourceDefinition('representationTypes', id)).toThrow(/referenced/)
    knot.removeRepresentation('experimental')
    expect(knot.removeResourceDefinition('representationTypes', id)).toBe(true)
    expect(knot.getResource(id)).toBeUndefined()
    expect(knot.toRaw().representationTypes?.some(x => x.id === id)).toBe(false)
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
