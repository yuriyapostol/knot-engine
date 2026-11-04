import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import {
  Knot, STANDARD_NAMES, STANDARD_RESOURCES, GEOMETRY_3D, ROPE_TYPE,
  resolveResourceURI, expandURI, validateResourceDocument, validateResourceRegistry,
  selectRepresentation, type RawKnot, type RawResourceRegistry, type ResourceEntry,
  LOMONACO_KAUFFMAN_11, PD_CCW_UNDER_FIRST, DT_SIGNED_EVEN,
  validateMosaicDiagram, validatePDCode, validateDTCode,
} from '../src/core'
import { normalizeKnot, validateKnot } from '../src/core/validateKnot'
import { selectKnot, composeKnot } from '../src/core/knotParts'
import schema from '../v1/schema/knot.schema.json'
import open from '../v1/examples/knots/open-rope.json'
import mosaic from '../v1/examples/knots/mosaic-diagram.json'
import pd from '../v1/examples/knots/pd-trefoil.json'
import dt from '../v1/examples/knots/dt-trefoil.json'

const check = new Ajv2020({ strict: false }).compile(schema)
const fixture = (): RawKnot => ({ ...structuredClone(open) as RawKnot, algorithms: [{ id: 'undo', purpose: 'untying', steps: [{ id: 'start' }] }] })

describe('standard resource identities', () => {
  for (const [kind, names] of Object.entries(STANDARD_NAMES)) {
    for (const name of names) it(`resolves the reserved ${kind} name ${name} to a published resource`, () => {
      const uri = resolveResourceURI(name, kind as ResourceEntry['kind'])
      const entry = STANDARD_RESOURCES.resources.find(entry => entry.kind === kind && expandURI(entry.resource.id, STANDARD_RESOURCES.namespaces) === uri)
      expect(entry).toBeDefined()
      expect(resolveResourceURI(uri, kind as ResourceEntry['kind'])).toBe(uri)
      expect(resolveResourceURI('std:' + uri.split('/v1/')[1], kind as ResourceEntry['kind'], { std: 'https://yuriyapostol.github.io/knot-engine/v1/' })).toBe(uri)
    })
  }
  it('accepts short, compact and absolute identities without embedded definitions or input mutation', () => {
    const short = fixture(), before = structuredClone(short), absolute = normalizeKnot(short)
    expect(check(short), JSON.stringify(check.errors)).toBe(true)
    expect(validateKnot(short)).toMatchObject({ valid: true, complete: true, missingDependencies: [] })
    expect(validateKnot(absolute)).toMatchObject({ valid: true, complete: true })
    expect(absolute.representations![0].type).toBe(GEOMETRY_3D)
    expect((absolute.constructions![0] as any).objects[0].type).toBe(ROPE_TYPE)
    expect(short.representationTypes).toBeUndefined()
    expect(short.objectTypes).toBeUndefined()
    expect(short.algorithmPurposes).toBeUndefined()
    expect(selectRepresentation(short, { type: '3d' })).toMatchObject({ ok: true, typeUri: GEOMETRY_3D })
    expect(short).toEqual(before)
  })
  it('keeps standard spellings scoped and rejects unknown bare names', () => {
    expect(() => expandURI('3d')).toThrow()
    expect(() => resolveResourceURI('3d', 'object-type')).toThrow()
    expect(() => resolveResourceURI('custom', 'representation-type')).toThrow()
    expect(resolveResourceURI('3d', 'representation-type', { '3d': 'urn:wrong:' })).toBe(GEOMETRY_3D)
    for (const kind of ['representation-type', 'object-type', 'algorithm-purpose'] as const) {
      expect(() => resolveResourceURI('unknown:value', kind)).toThrow()
    }
  })
  it('shares frozen standard definitions and resolves purpose labels in prepared and cloned knots', () => {
    expect(Object.isFrozen(STANDARD_RESOURCES.resources)).toBe(true)
    expect(Object.isFrozen(STANDARD_RESOURCES.resources[0].resource)).toBe(true)
    const raw = fixture(), knot = Knot.from(raw, { locale: 'uk' })
    expect(knot.getRepresentation('view-3d-rest')!.getTypeDefinition()?.getName()).toBe('Геометрія 3D')
    expect(knot.getResource('rope', 'object-type')?.getName()).toBe('Мотузка')
    expect(knot.getAlgorithm('undo')!.getPurposeDefinition()?.getName()).toBe('Розв’язування')
    expect(knot.clone().getAlgorithm('undo')!.getPurposeDefinition()?.getName()).toBe('Розв’язування')
    expect(knot.toRaw()).toEqual(raw)
  })
  it('exports canonical identities with all required standard definitions and composes equivalent spellings', () => {
    const short = fixture(), canonical = normalizeKnot(short)
    const exported = selectKnot(short, { representations: ['view-3d-rest'], algorithms: ['undo'] })
    expect(exported.representations![0].type).toBe(GEOMETRY_3D)
    expect(exported.representationTypes).toHaveLength(1)
    expect(exported.objectTypes).toHaveLength(1)
    expect(exported.algorithmPurposes).toHaveLength(1)
    expect(exported.algorithmPurposes![0].id).toBe(exported.algorithms![0].purpose)
    expect(validateKnot(exported)).toMatchObject({ valid: true, complete: true })
    expect(composeKnot([short, canonical]).algorithms).toEqual(canonical.algorithms)
    expect(exported).toEqual(selectKnot(canonical, { representations: ['view-3d-rest'], algorithms: ['undo'] }))
  })
  it('rejects standard redefinition in inline, registry, standalone and prepared contexts', () => {
    const definition = structuredClone(STANDARD_RESOURCES.resources.find(entry => entry.kind === 'representation-type' && entry.resource.name === '3d')!)
    if (definition.kind !== 'representation-type') throw new Error('Expected representation type')
    definition.resource.dataSchema = { inline: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string' } }
    const registry: RawResourceRegistry = { schema: 'ResourceRegistry', schemaVersion: 1, namespaces: STANDARD_RESOURCES.namespaces, resources: [definition] }
    expect(validateResourceRegistry(registry).valid).toBe(false)
    expect(validateResourceDocument({ schema: 'ResourceDocument', schemaVersion: 1, namespaces: registry.namespaces, ...definition }).valid).toBe(false)
    expect(validateKnot(fixture(), { registries: [registry] }).valid).toBe(false)
    expect(validateKnot({ ...fixture(), representationTypes: [definition.resource] }).valid).toBe(false)
    expect(() => Knot.from(fixture(), { registries: [registry] })).toThrow(/Conflicting standard resource/)
    expect(() => Knot.from(fixture()).addResourceDefinition('representationTypes', definition.resource)).toThrow(/Conflicting standard resource/)
  })
})

it('resolves custom purposes from inline definitions or explicit registries and exports them', () => {
  const purpose = { id: 'urn:example:inspection', name: 'Inspection', description: 'Inspect a knot', specification: 'urn:example:inspection-spec' }
  const raw = fixture()
  raw.algorithms![0].purpose = purpose.id
  expect(validateKnot(raw)).toMatchObject({ valid: true, complete: false, missingDependencies: [{ kind: 'algorithm-purpose', ref: purpose.id }], uncheckedTypes: [] })
  const registry: RawResourceRegistry = { schema: 'ResourceRegistry', schemaVersion: 1, resources: [{ kind: 'algorithm-purpose', resource: purpose }] }
  expect(validateResourceRegistry(registry).valid).toBe(true)
  expect(validateKnot(raw, { registries: [registry] })).toMatchObject({ valid: true, complete: true })
  const knot = Knot.from(raw, { registries: [registry] })
  expect(knot.getAlgorithm('undo')!.getPurposeDefinition()?.getName('en')).toBe('Inspection')
  const extracted = knot.select({ algorithms: ['undo'] })
  expect(extracted.toRaw().algorithmPurposes).toEqual([purpose])
  expect(extracted.validate()).toMatchObject({ valid: true, complete: true })
  const local = Knot.from(raw)
  local.addResourceDefinition('algorithmPurposes', purpose)
  expect(local.validate()).toMatchObject({ valid: true, complete: true })
  expect(local.removeResourceDefinition('algorithmPurposes', purpose.id)).toBe(true)
  expect(local.validate()).toMatchObject({ valid: true, complete: false })
  const wrong = { ...raw, catalogs: [{ id: purpose.id, name: 'Wrong kind', description: 'Catalog' }] }
  expect(validateKnot(wrong).valid).toBe(false)
})

for (const [source, field, kind, short, uri, validate] of [
  [mosaic, 'tileSet', 'tile-set', 'lomonaco-kauffman-11', LOMONACO_KAUFFMAN_11, validateMosaicDiagram],
  [pd, 'convention', 'convention', 'pd-ccw-under-first', PD_CCW_UNDER_FIRST, validatePDCode],
  [dt, 'convention', 'convention', 'dt-signed-even', DT_SIGNED_EVEN, validateDTCode],
] as const) {
  it(`validates and exports short, absolute and compact ${short} identities`, () => {
    const knot = structuredClone(source) as RawKnot
    delete knot.namespaces
    const before = structuredClone(knot)
    const representation = knot.representations![0]
    expect((representation.data as any)[field]).toBe(short)
    expect(check(knot), JSON.stringify(check.errors)).toBe(true)
    expect(validateKnot(knot)).toMatchObject({ valid: true, complete: true })
    expect(validate(representation.data)).toMatchObject({ valid: true })
    const absolute = normalizeKnot(knot)
    expect((absolute.representations![0].data as any)[field]).toBe(uri)
    const compact = structuredClone(knot)
    compact.namespaces = { ext: uri.slice(0, uri.lastIndexOf('/') + 1) }
    ;(compact.representations![0].data as any)[field] = 'ext:' + short
    expect(validateKnot(compact)).toMatchObject({ valid: true, complete: true })
    const exported = selectKnot(knot, { representations: [representation.id] })
    const definitions = kind === 'tile-set' ? exported.tileSets : exported.conventions
    expect(definitions).toHaveLength(1)
    expect(definitions![0].id).toBe(uri)
    expect(exported).toEqual(selectKnot(compact, { representations: [representation.id] }))
    expect(exported).toEqual(selectKnot(absolute, { representations: [representation.id] }))
    expect(Knot.from(knot).getResource(short, kind)?.id).toBeDefined()
    expect(knot).toEqual(before)
    expect(validate({ ...(representation.data as object), [field]: 'urn:unsupported' }).valid).toBe(false)
    expect(validateKnot({ ...knot, representations: [{ ...representation, data: { ...(representation.data as object), [field]: 'urn:unsupported' } }] }).valid).toBe(false)
    const definition = structuredClone(STANDARD_RESOURCES.resources.find(entry => entry.kind === kind && expandURI(entry.resource.id, STANDARD_RESOURCES.namespaces) === uri)!)
    if (definition.kind !== 'tile-set' && definition.kind !== 'convention') throw new Error('Expected tile-set or convention')
    definition.resource.description = 'Changed standard meaning'
    expect(validateResourceDocument({ schema: 'ResourceDocument', schemaVersion: 1, namespaces: STANDARD_RESOURCES.namespaces, ...definition }).valid).toBe(false)
  })
}

it('does not interpret another built-in convention as a supported PD or DT convention', () => {
  expect(validatePDCode({ ...pd.representations[0].data, convention: 'dt-signed-even' }).valid).toBe(false)
  expect(validateDTCode({ ...dt.representations[0].data, convention: 'pd-ccw-under-first' }).valid).toBe(false)
})

it('supports external tile-set and convention resources without extending built-in data profiles', () => {
  for (const [collection, kind] of [['tileSets', 'tile-set'], ['conventions', 'convention']] as const) {
    const definition = { id: 'urn:example:' + kind, name: 'External', description: 'External definition', specification: 'urn:example:spec' }
    const raw: RawKnot = { schema: 'Knot', schemaVersion: 1, id: 'external', subject: { id: 's' }, dependencies: [{ kind, ref: definition.id }] }
    expect(validateKnot(raw)).toMatchObject({ valid: true, complete: false, missingDependencies: [{ kind, ref: definition.id }] })
    expect(validateKnot({ ...raw, [collection]: [definition] })).toMatchObject({ valid: true, complete: true })
    const knot = Knot.from(raw)
    knot.addResourceDefinition(collection, definition)
    expect(knot.getResource(definition.id, kind)?.getName('en')).toBe('External')
    expect(knot.validate()).toMatchObject({ valid: true, complete: true })
    expect(knot.clone().getResource(definition.id, kind)?.getName('en')).toBe('External')
    expect(knot.removeResourceDefinition(collection, definition.id)).toBe(true)
    expect(knot.validate()).toMatchObject({ valid: true, complete: false })
  }
})
