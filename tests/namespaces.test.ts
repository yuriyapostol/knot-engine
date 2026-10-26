import { validateKnot } from '../src/core/validateKnot'
import { selectKnot } from '../src/core/knotParts'
import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { KNOT_NAMESPACE, validateRepresentationDocument, validateResourceDocument, validateResourceRegistry, STANDARD_RESOURCES, type RawKnot, type RawResourceRegistry } from '../src/core'
import { normalizeKnot } from '../src/core/validateKnot'

for (const name of ['dt-trefoil', 'pd-trefoil', 'mosaic-diagram']) {
  it(`expands known data URI fields in ${name} without mutating input`, () => {
    const compact: RawKnot = JSON.parse(readFileSync(`v1/examples/knots/${name}.json`, 'utf8'))
    const before = JSON.stringify(compact)
    const absolute = normalizeKnot(compact)
    expect(validateKnot(compact)).toMatchObject({ valid: true, complete: true })
    expect(validateKnot(absolute)).toMatchObject({ valid: true, complete: true })
    const representation = compact.representations![0]
    expect(selectKnot(compact, { representations: [representation.id] })).toEqual(selectKnot(absolute, { representations: [representation.id] }))
    const data = absolute.representations![0].data as Record<string, unknown>
    expect(data.convention ?? data.tileSet).toMatch(/^https:\/\//)
    expect(validateRepresentationDocument({ schema: 'RepresentationDocument', schemaVersion: 1, namespaces: compact.namespaces, representation }, { registries: [STANDARD_RESOURCES] })).toMatchObject({ valid: true, complete: true })
    expect(JSON.stringify(compact)).toBe(before)
    const invalid = structuredClone(compact)
    const invalidData = invalid.representations![0].data as Record<string, unknown>
    invalidData['convention' in invalidData ? 'convention' : 'tileSet'] = 'undeclared:value'
    expect(validateKnot(invalid).valid).toBe(false)
  })
}

it('resolves compact schema references using each resource document or registry namespace', () => {
  const namespaces = { ex: 'urn:example:', schema: 'https://example.org/schema/' }
  const resource = { id: 'ex:custom', name: 'Custom', description: 'Custom integer', specification: 'ex:spec', dataSchema: { ref: 'schema:integer' } }
  const registry: RawResourceRegistry = { schema: 'ResourceRegistry', schemaVersion: 1, namespaces, resources: [{ kind: 'representation-type', resource }] }
  const document = { schema: 'ResourceDocument', schemaVersion: 1, namespaces, kind: 'representation-type', resource }
  expect(validateResourceRegistry(registry).valid).toBe(true)
  expect(validateResourceDocument(document).valid).toBe(true)
  const knot = { schema: 'Knot', schemaVersion: 1, id: 'a', subject: { id: 's' }, namespaces: { ex: 'urn:example:', schema: 'urn:different:' }, representations: [{ id: 'r', type: 'ex:custom', data: 3 }] }
  const options = { registries: [registry], schemas: [{ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://example.org/schema/integer', type: 'integer' }] }
  expect(validateKnot(knot, options)).toMatchObject({ valid: true })
  expect(validateKnot({ ...knot, representations: [{ ...knot.representations[0], data: 'bad' }] }, options).valid).toBe(false)
  expect(validateKnot({ ...knot, namespaces, representationTypes: [resource] }, { schemas: options.schemas })).toMatchObject({ valid: true })
  for (const ref of ['undeclared:integer', 'integer']) {
    expect(validateResourceDocument({ ...document, resource: { ...resource, dataSchema: { ref } } }).valid).toBe(false)
  }
})

it('preserves inline schema keywords, literal URI strings and unknown representation data', () => {
  const data = { convention: 'knot-engine:conventions/dt-signed-even', tileSet: 'knot-engine:tile-sets/lomonaco-kauffman-11', url: 'knot-engine:literal', nested: { type: 'knot-engine:literal' } }
  const inline = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://example.org/schema/custom', $defs: { literal: { const: data } }, $ref: '#/$defs/literal' }
  const knot: RawKnot = { schema: 'Knot', schemaVersion: 1, id: 'custom', subject: { id: 's' }, namespaces: { 'knot-engine': KNOT_NAMESPACE }, representationTypes: [{ id: 'urn:custom', name: 'Custom', description: 'Literal data', specification: 'urn:spec', dataSchema: { inline } }], representations: [{ id: 'r', type: 'urn:custom', data }] }
  const normalized = normalizeKnot(knot)
  expect(normalized.representations![0].data).toEqual(data)
  expect(normalized.representationTypes![0].dataSchema.inline).toEqual(inline)
  expect(validateKnot(knot)).toMatchObject({ valid: true })
  const wrongSchema = structuredClone(knot)
  wrongSchema.representationTypes![0].dataSchema = { inline: { ...inline, $ref: 'knot-engine:literal' } }
  expect(normalizeKnot(wrongSchema).representationTypes![0].dataSchema.inline!.$ref).toBe('knot-engine:literal')
})
