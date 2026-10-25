import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { KNOT_NAMESPACE, validateAsset, validateRepresentationDocument, validateResourceDocument, validateResourceRegistry, selectAsset, STANDARD_RESOURCES, type RawAsset, type RawKnotResourceRegistry } from '../src/core'
import { normalizeAsset } from '../src/core/validateAsset'

for (const name of ['dt-trefoil', 'pd-trefoil', 'mosaic-diagram']) {
  it(`expands known data URI fields in ${name} without mutating input`, () => {
    const compact: RawAsset = JSON.parse(readFileSync(`v1/examples/assets/${name}.json`, 'utf8'))
    const before = JSON.stringify(compact)
    const absolute = normalizeAsset(compact)
    expect(validateAsset(compact)).toMatchObject({ valid: true, complete: true })
    expect(validateAsset(absolute)).toMatchObject({ valid: true, complete: true })
    const representation = compact.representations![0]
    expect(selectAsset(compact, { representations: [representation.id] })).toEqual(selectAsset(absolute, { representations: [representation.id] }))
    const data = absolute.representations![0].data as Record<string, unknown>
    expect(data.convention ?? data.tileSet).toMatch(/^https:\/\//)
    expect(validateRepresentationDocument({ schema: 'KnotRepresentationDocument', schemaVersion: 1, namespaces: compact.namespaces, representation }, { registries: [STANDARD_RESOURCES] })).toMatchObject({ valid: true, complete: true })
    expect(JSON.stringify(compact)).toBe(before)
    const invalid = structuredClone(compact)
    const invalidData = invalid.representations![0].data as Record<string, unknown>
    invalidData['convention' in invalidData ? 'convention' : 'tileSet'] = 'undeclared:value'
    expect(validateAsset(invalid).valid).toBe(false)
  })
}

it('resolves compact schema references using each resource document or registry namespace', () => {
  const namespaces = { ex: 'urn:example:', schema: 'https://example.org/schema/' }
  const resource = { id: 'ex:custom', name: 'Custom', description: 'Custom integer', specification: 'ex:spec', dataSchema: { ref: 'schema:integer' } }
  const registry: RawKnotResourceRegistry = { schema: 'KnotResourceRegistry', schemaVersion: 1, namespaces, resources: [{ kind: 'representation-type', resource }] }
  const document = { schema: 'KnotResourceDocument', schemaVersion: 1, namespaces, kind: 'representation-type', resource }
  expect(validateResourceRegistry(registry).valid).toBe(true)
  expect(validateResourceDocument(document).valid).toBe(true)
  const asset = { schema: 'Asset', schemaVersion: 1, id: 'a', subject: { id: 's' }, namespaces: { ex: 'urn:example:', schema: 'urn:different:' }, representations: [{ id: 'r', type: 'ex:custom', data: 3 }] }
  const options = { registries: [registry], schemas: [{ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://example.org/schema/integer', type: 'integer' }] }
  expect(validateAsset(asset, options)).toMatchObject({ valid: true })
  expect(validateAsset({ ...asset, representations: [{ ...asset.representations[0], data: 'bad' }] }, options).valid).toBe(false)
  expect(validateAsset({ ...asset, namespaces, representationTypes: [resource] }, { schemas: options.schemas })).toMatchObject({ valid: true })
  for (const ref of ['undeclared:integer', 'integer']) {
    expect(validateResourceDocument({ ...document, resource: { ...resource, dataSchema: { ref } } }).valid).toBe(false)
  }
})

it('preserves inline schema keywords, literal URI strings and unknown representation data', () => {
  const data = { convention: 'knot-engine:conventions/dt-signed-even', tileSet: 'knot-engine:tile-sets/lomonaco-kauffman-11', url: 'knot-engine:literal', nested: { type: 'knot-engine:literal' } }
  const inline = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://example.org/schema/custom', $defs: { literal: { const: data } }, $ref: '#/$defs/literal' }
  const asset: RawAsset = { schema: 'Asset', schemaVersion: 1, id: 'custom', subject: { id: 's' }, namespaces: { 'knot-engine': KNOT_NAMESPACE }, representationTypes: [{ id: 'urn:custom', name: 'Custom', description: 'Literal data', specification: 'urn:spec', dataSchema: { inline } }], representations: [{ id: 'r', type: 'urn:custom', data }] }
  const normalized = normalizeAsset(asset)
  expect(normalized.representations![0].data).toEqual(data)
  expect(normalized.representationTypes![0].dataSchema.inline).toEqual(inline)
  expect(validateAsset(asset)).toMatchObject({ valid: true })
  const wrongSchema = structuredClone(asset)
  wrongSchema.representationTypes![0].dataSchema = { inline: { ...inline, $ref: 'knot-engine:literal' } }
  expect(normalizeAsset(wrongSchema).representationTypes![0].dataSchema.inline!.$ref).toBe('knot-engine:literal')
})
