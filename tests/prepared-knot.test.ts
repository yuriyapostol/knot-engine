import { validateKnot } from '../src/core/validateKnot'
import { describe, expect, it } from 'vitest'
import { Knot, configureLocalization, subscribeLocalization, STANDARD_RESOURCES, expandURI } from '../src/core'
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
  it('shares registry definitions without copying or mutating their prototypes', () => {
    const id = STANDARD_RESOURCES.resources[0].resource.id
    const source = STANDARD_RESOURCES.resources[0].resource
    const originalPrototype = Object.getPrototypeOf(source)
    const registryOnly = { ...raw, catalogs: [], representationTypes: [], objectTypes: [] }
    const first = Knot.from(registryOnly as any, { registries: [STANDARD_RESOURCES], locale: 'uk' })
    const second = Knot.from(registryOnly as any, { registries: [STANDARD_RESOURCES], locale: 'en' })
    const a = first.getResource(id)!
    const b = second.getResource(id)!
    expect(a).not.toBe(b)
    expect(STANDARD_RESOURCES.resources.some(entry => entry.resource === Object.getPrototypeOf(a))).toBe(true)
    expect(STANDARD_RESOURCES.resources.some(entry => entry.resource === Object.getPrototypeOf(b))).toBe(true)
    expect(Object.getPrototypeOf(source)).toBe(originalPrototype)
    expect(first.getResource(id)).toBe(a)
    expect(second.getResource(id)).toBe(b)
    expect(JSON.stringify(source)).not.toContain('getName')
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
  it('restores registry definitions after removing an inline override', () => {
    const source = STANDARD_RESOURCES.resources.find(entry => entry.kind === 'representation-type' && expandURI(entry.resource.id, STANDARD_RESOURCES.namespaces) === expandURI(raw.representations[0].type, raw.namespaces))!.resource as any
    const knot = Knot.from({ ...raw, catalogs: [], representationTypes: [], objectTypes: [] } as any, {
      registries: [STANDARD_RESOURCES],
    })
    const original = knot.getResource(source.id)!
    const rep = knot.getRepresentation('view-3d-rest')!
    const local = knot.addResourceDefinition('representationTypes', { ...source, name: 'Temporary type' })
    expect(knot.getResource(source.id)).toBe(local)
    expect(rep.getTypeDefinition()).toBe(local)
    expect(knot.removeResourceDefinition('representationTypes', source.id)).toBe(true)
    const restored = knot.getResource(source.id)!
    expect(restored).not.toBe(local)
    expect(Object.getPrototypeOf(restored)).toBe(source)
    expect(rep.getTypeDefinition()).toBe(restored)
    expect(rep).toBe(knot.getRepresentation('view-3d-rest'))
    expect(knot.removeResourceDefinition('representationTypes', source.id)).toBe(false)
    expect(original.getName('en')).toBe(restored.getName('en'))
    expect(source.name).not.toBe('Temporary type')
  })
  it('rejects removal of a referenced type only when no fallback exists', () => {
    const knot = Knot.from({ ...raw, catalogs: [], representationTypes: [], objectTypes: [] } as any)
    const type = 'https://example.org/types/custom'
    knot.addResourceDefinition('representationTypes', { id: type, name: 'Custom' } as any)
    knot.addRepresentation({ id: 'custom', type, data: {} })
    expect(() => knot.removeResourceDefinition('representationTypes', type)).toThrow(/referenced/)
    expect(knot.getResource(type)).toBeDefined()
    expect(knot.representationTypes?.some(x => x.id === type)).toBe(true)
  })
  it('protects representations referenced by procedure steps', () => {
    const knot = Knot.from(raw as any)
    knot.addProcedure({ id: 'guide', steps: [{ id: 'one', representations: [{ id: 'view-3d-rest' }] }] })
    expect(() => knot.removeRepresentation('view-3d-rest')).toThrow(/procedure step/)
    expect(knot.getRepresentation('view-3d-rest')).toBeDefined()
    knot.getProcedure('guide')!.removeStep('one')
    expect(knot.removeRepresentation('view-3d-rest')).toBe(true)
  })
  it('protects catalogs and object types referenced by local entities', () => {
    const knot = Knot.from(raw as any)
    const catalogId = 'https://example.org/catalogs/example'
    const objectId = 'https://example.org/types/example-object'
    knot.addResourceDefinition('catalogs', { id: catalogId, name: 'Example', description: 'Example catalog' })
    knot.subject.identifiers = [{ catalog: catalogId, value: 'K-1' }]
    expect(() => knot.removeResourceDefinition('catalogs', catalogId)).toThrow(/subject identifier/)
    knot.subject.identifiers = []
    expect(knot.removeResourceDefinition('catalogs', catalogId)).toBe(true)
    knot.addResourceDefinition('objectTypes', { id: objectId, name: 'Example', description: 'Example type', specification: 'https://example.org/spec', dataSchema: { inline: {} } })
    knot.constructions = [{ id: 'construction', objects: [{ id: 'rope', type: objectId }] }]
    expect(() => knot.removeResourceDefinition('objectTypes', objectId)).toThrow(/construction object/)
    knot.constructions = []
    expect(knot.removeResourceDefinition('objectTypes', objectId)).toBe(true)
  })
  it('preserves construction references across controlled edits', () => {
    const knot = Knot.from({ ...raw, constructions: [] } as any)
    const construction = knot.addConstruction({ id: 'test-construction', objects: [], states: [{ id: 'tied' }] })
    expect(knot.getConstruction('test-construction')).toBe(construction)
    expect(() => knot.constructions?.push(construction)).toThrow()
    const rep = knot.addRepresentation({
      id: 'construction-view', type: 'https://example.org/representation-types/unknown',
      target: { kind: 'state', construction: { id: 'test-construction' }, id: 'tied' }, data: {},
    })
    expect(() => knot.removeConstruction('test-construction')).toThrow(/representation/)
    expect(knot.getConstruction('test-construction')).toBe(construction)
    knot.removeRepresentation(rep.id)
    const procedure = knot.addProcedure({ id: 'construction-procedure', construction: { id: 'test-construction' }, steps: [] })
    expect(() => knot.removeConstruction('test-construction')).toThrow(/procedure/)
    knot.removeProcedure(procedure.id)
    expect(knot.removeConstruction('test-construction')).toBe(true)
    expect(knot.getConstruction('test-construction')).toBeUndefined()
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
