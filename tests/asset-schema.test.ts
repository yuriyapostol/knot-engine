import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import { readFileSync, readdirSync } from 'node:fs'
import schema from '../schema/knot-asset-v1.schema.json'
import { validateKnotAsset } from '../src/core'
import open from '../examples/assets/open-rope.json'
import diagram from '../examples/assets/diagram-crossings.json'

const ajv = new Ajv2020({ allErrors: true, strictTypes: false })
const validate = ajv.compile(schema)

describe('KnotAsset JSON Schema and runtime alignment', () => {
  for (const file of readdirSync('examples/assets').filter(f => f.endsWith('.json'))) {
    it(`accepts ${file} in both validators`, () => {
      const data = JSON.parse(readFileSync(`examples/assets/${file}`, 'utf8'))
      expect(validate(data), JSON.stringify(validate.errors)).toBe(true)
      expect(validateKnotAsset(data, { strict: true }).valid).toBe(true)
    })
  }
  it('enforces dimension-specific points and forbids 3D crossings', () => {
    const wrong3 = structuredClone(open); wrong3.representations[0].snapshots[0].elements[0].geometry.points[0].pop()
    const wrong2 = structuredClone(diagram); wrong2.representations[0].snapshots[0].elements[0].geometry.points[0].push(0)
    const crossings3 = structuredClone(open); Object.assign(crossings3.representations[0].snapshots[0], { crossings: [] })
    for (const value of [wrong3, wrong2, crossings3]) {
      expect(validate(value)).toBe(false); expect(validateKnotAsset(value, { strict: true }).valid).toBe(false)
    }
  })
  it('rejects missing required fields, unknown fields, unsupported types, invalid scalars and curve limits', () => {
    const cases: unknown[] = [
      { ...open, units: 'relative' }, { ...open, schemaVersion: 2 }, { ...open, id: '' },
      { ...open, properties: {} }, { ...open, elements: [{ id: 's', type: 'mesh' }] },
      { ...open, representations: [{ ...open.representations[0], dimension: 4 }] }
    ]
    for (const key of ['schemaVersion', 'id', 'units', 'elements', 'representations']) {
      const a: Record<string, unknown> = structuredClone(open); delete a[key]; cases.push(a)
    }
    for (const length of [0, 1, 4097]) {
      const a = structuredClone(open)
      a.representations[0].snapshots[0].elements[0].geometry.points = Array.from({ length }, (_, i) => [i, 0, 0]); cases.push(a)
    }
    const closed = structuredClone(open); closed.representations[0].snapshots[0].elements[0].geometry.closed = true
    closed.representations[0].snapshots[0].elements[0].geometry.points.pop(); cases.push(closed)
    const ends = structuredClone(open); ends.elements[0].topology = 'closed'; cases.push(ends)
    for (const value of cases) {
      expect(validate(value), JSON.stringify(value).slice(0, 200)).toBe(false)
      expect(validateKnotAsset(value, { strict: true }).valid).toBe(false)
    }
  })
  it('documents semantic-only failures that require runtime validation', () => {
    for (const file of ['duplicate-element', 'broken-element', 'broken-variant', 'point-count']) {
      const data = JSON.parse(readFileSync(`examples/assets/invalid/${file}.json`, 'utf8'))
      expect(validate(data), JSON.stringify(validate.errors)).toBe(true)
      expect(validateKnotAsset(data, { strict: true }).valid).toBe(false)
    }
    const a = structuredClone(open)
    a.representations[0].snapshots[0].elements[0].geometry.points[1] = [0, 0, 0]
    expect(validate(a)).toBe(true)
    expect(validateKnotAsset(a).valid).toBe(false)
  })
})
