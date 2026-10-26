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
  it('preserves the untyped resource view when removing another kind with the same URI', () => {
    const uri = 'https://example.org/shared-removal'
    const knot = Knot.from(raw as any)
    const catalog = knot.addResourceDefinition('catalogs', { id: uri, name: 'Catalog', description: 'Catalog description' })
    knot.addResourceDefinition('representationTypes', { id: uri, name: 'Type' } as any)
    expect(knot.getResource(uri)?.getName()).toBe('Type')
    expect(knot.removeResourceDefinition('catalogs', uri)).toBe(true)
    expect(knot.getResource(uri)?.getName()).toBe('Type')
    expect(knot.getResource(uri, 'representation-type')?.getName()).toBe('Type')
    expect(knot.getResource(uri, 'catalog')).toBeUndefined()
    expect(catalog.getName()).toBe('Catalog')
  })
  it('does not alter the prepared source when callers mutate returned raw snapshots', () => {
    const knot = Knot.from(raw as any)
    const snapshot = knot.toRaw()
    snapshot.subject.id = 'changed-in-snapshot'
    expect(knot.subject.id).toBe(raw.subject.id)
    const clone = knot.clone()
    clone.subject.id = 'changed-in-clone'
    expect(knot.subject.id).toBe(raw.subject.id)
  })
  it('restores a same-kind registry resource without overwriting a different-kind untyped view', () => {
    const uri = 'https://example.org/shared-fallback'
    const registry = { resources: [
      { kind: 'catalog', resource: { id: uri, name: 'Registry catalog', description: 'Catalog description' } },
    ] }
    const knot = Knot.from(raw as any, { registries: [registry as any] })
    knot.addResourceDefinition('catalogs', { id: uri, name: 'Local catalog', description: 'Local description' })
    knot.addResourceDefinition('representationTypes', { id: uri, name: 'Local type' } as any)
    expect(knot.removeResourceDefinition('catalogs', uri)).toBe(true)
    expect(knot.getResource(uri, 'catalog')?.getName()).toBe('Registry catalog')
    expect(knot.getResource(uri)?.getName()).toBe('Local type')
  })
  it('does not inherit localized metadata across registry resource kinds sharing a URI', () => {
    const uri = 'https://example.org/shared-resource'
    const registry = {
      resources: [
        { kind: 'catalog', resource: { id: uri, names: [{ language: 'en', value: 'Catalog name' }] } },
        { kind: 'representation-type', resource: { id: uri, name: 'Representation type' } },
      ],
    }
    const knot = Knot.from(raw as any, { registries: [registry as any], locale: 'en' })
    expect(knot.getResource(uri, 'catalog')?.getName()).toBe('Catalog name')
    expect(knot.getResource(uri, 'representation-type')?.getName()).toBe('Representation type')
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
    procedure.steps.push({ id: 'direct-step' } as any)
    expect(procedure.steps.some(step => step.id === 'direct-step')).toBe(true)
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
  it('uses per-Knot locale for subject, procedures and steps, including newly added steps', () => {
    const bilingual = [{ language: 'en', value: 'English' }, { language: 'uk', value: 'Українська' }]
    const input = {
      ...raw, subject: { ...raw.subject, names: bilingual },
      procedures: [{ id: 'guide', names: bilingual, descriptions: bilingual,
        steps: [{ id: 'first', names: bilingual, instructions: bilingual }] }],
    }
    configureLocalization({ locale: 'en', fallbackLocale: 'en' })
    const uk = Knot.from(input as any, { locale: 'uk' })
    const en = Knot.from(input as any, { locale: 'en' })
    expect(uk.subject.getName()).toBe('Українська')
    expect(en.subject.getName()).toBe('English')
    expect(uk.getProcedure('guide')!.getDescription()).toBe('Українська')
    expect(uk.getProcedure('guide')!.getStep('first')!.getInstructions()).toBe('Українська')
    const added = uk.getProcedure('guide')!.addStep({ id: 'second', names: bilingual, instructions: bilingual })
    expect(added.getInstructions()).toBe('Українська')
    expect(uk.clone().getProcedure('guide')!.getStep('second')!.getName()).toBe('Українська')
    expect(uk.toRaw()).toEqual({ ...input, procedures: [{ ...input.procedures[0], steps: [...input.procedures[0].steps, { id: 'second', names: bilingual, instructions: bilingual }] }] })
    expect(en.getProcedure('guide')!.getStep('first')!.getName()).toBe('English')
  })
  it('applies per-Knot name overrides to subject, procedure and step without changing raw text', () => {
    const bilingual = [{ language: 'en', value: 'Original' }]
    const input = { ...raw, subject: { ...raw.subject, names: bilingual },
      procedures: [{ id: 'guide', names: bilingual, descriptions: bilingual, steps: [{ id: 'first', names: bilingual }] }] }
    const knot = Knot.from(input as any, { locale: 'uk', overrides: {
      [raw.subject.id]: { names: [{ language: 'uk', value: 'Предмет' }] },
      guide: { descriptions: [{ language: 'uk', value: 'Опис' }] },
      first: { names: [{ language: 'uk', value: 'Крок' }] },
    } })
    expect(knot.subject.getName()).toBe('Предмет')
    expect(knot.getProcedure('guide')!.getDescription()).toBe('Опис')
    expect(knot.getProcedure('guide')!.getStep('first')!.getName()).toBe('Крок')
    expect(knot.toRaw()).toEqual(input)
  })
  it('preserves per-Knot localization and raw serialization across clone, select and compose', () => {
    const bilingual = [{ language: 'en', value: 'Original' }, { language: 'uk', value: 'Український' }]
    const input = { ...raw, subject: { ...raw.subject, names: bilingual } }
    const options = { registries: [STANDARD_RESOURCES], locale: 'uk', overrides: {
      [raw.subject.id]: { names: [{ language: 'uk', value: 'Перевизначено' }] },
      'view-3d-rest': { names: [{ language: 'uk', value: 'Просторовий вигляд' }] },
    } }
    const knot = Knot.from(input as any, options)
    const clone = knot.clone()
    const selected = knot.select({ representations: ['view-3d-rest'] })
    for (const item of [knot, clone, selected]) {
      expect(item.subject.getName()).toBe('Перевизначено')
      expect(item.getRepresentation('view-3d-rest')!.getName()).toBe('Просторовий вигляд')
      expect(item.toRaw().subject.names).toEqual(bilingual)
    }
    expect(clone.subject).not.toBe(knot.subject)
    expect(selected.getRepresentation('view-3d-rest')).not.toBe(knot.getRepresentation('view-3d-rest'))
    const composed = Knot.compose([selected, selected.clone()], options)
    expect(composed.subject.getName()).toBe('Перевизначено')
    expect(composed.getRepresentation('view-3d-rest')!.getName()).toBe('Просторовий вигляд')
    expect(composed.toRaw().subject.names).toEqual(bilingual)
  })
  it('edits construction states and objects without replacing the construction or mutating inputs', () => {
    const knot = Knot.from(raw as any, { registries: [STANDARD_RESOURCES] })
    const construction = knot.getConstruction('setup')!
    const originalRepresentation = knot.getRepresentation('view-3d-rest')
    const stateInput = { id: 'extra-state', name: 'Extra state' }
    const objectInput = { id: 'extra-rope', type: 'knot-engine:object-types/rope',
      topology: 'open', ends: [{ id: 'a' }, { id: 'b' }] }
    const state = knot.addConstructionState('setup', stateInput)
    const object = knot.addConstructionObject('setup', objectInput)
    expect(state).not.toBe(stateInput)
    expect(object).not.toBe(objectInput)
    expect(knot.getConstruction('setup')).toBe(construction)
    expect(knot.getRepresentation('view-3d-rest')).toBe(originalRepresentation)
    expect(() => knot.addConstructionState('setup', stateInput)).toThrow(/Duplicate/)
    expect(() => knot.addConstructionObject('setup', objectInput)).toThrow(/Duplicate/)
    expect(() => knot.addConstructionState('missing', stateInput)).toThrow(/Unknown/)
    expect(() => knot.addConstructionObject('missing', objectInput)).toThrow(/Unknown/)
    expect(knot.validate().valid).toBe(true)
    expect(knot.clone().getConstruction('setup')?.states?.some(x => x.id === state.id)).toBe(true)
    expect(knot.toRaw().constructions?.some(c => 'id' in c && c.id === 'setup' &&
      c.objects.some(x => x.id === object.id))).toBe(true)
    expect(knot.removeConstructionState('setup', state.id)).toBe(true)
    expect(knot.removeConstructionObject('setup', object.id)).toBe(true)
    expect(knot.validate().valid).toBe(true)
  })
  it('resolves representation types by kind when another resource shares the URI', () => {
    const uri = 'https://example.org/shared-kind-uri'
    const knot = Knot.from(raw as any)
    knot.addResourceDefinition('catalogs', { id: uri, name: 'Catalog', description: 'Catalog description' })
    const definition = knot.addResourceDefinition('representationTypes', {
      id: uri, name: 'Representation type', description: 'Type description',
      specification: 'https://example.org/spec', dataSchema: { inline: { $schema: 'https://json-schema.org/draft/2020-12/schema' } },
    })
    const representation = knot.addRepresentation({ id: 'shared-type-representation', type: uri, data: {} })
    expect(representation.getTypeDefinition()).toBe(definition)
    expect(knot.getResource(uri, 'catalog')?.getName()).toBe('Catalog')
    expect(knot.getResource(uri, 'representation-type')?.getName()).toBe('Representation type')
    expect(knot.removeResourceDefinition('catalogs', uri)).toBe(true)
    expect(representation.getTypeDefinition()).toBe(definition)
    expect(knot.getResource(uri, 'catalog')).toBeUndefined()
    expect(knot.getResource(uri, 'representation-type')).toBe(definition)
  })
})
