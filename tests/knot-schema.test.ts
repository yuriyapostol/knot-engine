import { validateKnot } from '../src/core/validateKnot'
import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import { readFileSync,readdirSync } from 'node:fs'
import knotSchema from '../v1/schema/knot.schema.json'
import mosaicSchema from '../v1/schema/mosaic-diagram.schema.json'
import dtSchema from '../v1/schema/dt-code.schema.json'
import pdSchema from '../v1/schema/pd-code.schema.json'
import gridSchema from '../v1/schema/grid-diagram.schema.json'
import geometry2dSchema from '../v1/schema/2d.schema.json'
import geometry3dSchema from '../v1/schema/3d.schema.json'

import { normalizeKnot } from '../src/core/validateKnot'
const ajv=new Ajv2020({strict:false}),knot=ajv.compile(knotSchema),geometry2d=ajv.compile(geometry2dSchema),geometry3d=ajv.compile(geometry3dSchema),grid=ajv.compile(gridSchema),mosaic=ajv.compile(mosaicSchema),pd=ajv.compile(pdSchema),dt=ajv.compile(dtSchema)
const algorithmKnot = (step: object, purpose?: unknown) => ({ schema: 'Knot', schemaVersion: 1, id: 'guide', subject: { id: 'rope' }, algorithms: [{ id: 'guide', ...(purpose === undefined ? {} : { purpose }), steps: [{ id: 'first', ...step }] }] })
it.each([undefined, { count: 1 }, { count: 3 }, { min: 2 }, { max: 4 }, { min: 2, max: 4 }, { min: 2, max: 2 }])('accepts repeat execution counts %j in schema and runtime', repeat => {
  const value = algorithmKnot(repeat === undefined ? {} : { repeat })
  expect(knot(value), JSON.stringify(knot.errors)).toBe(true)
  expect(validateKnot(value)).toMatchObject({ valid: true, complete: true })
})
it.each([{}, { count: 0 }, { min: 0 }, { max: 0 }, { count: -1 }, { min: -1 }, { max: -1 }, { count: 1.5 }, { min: 1.5 }, { max: 1.5 }, { count: '2' }, { count: 2, min: 1 }, { count: 2, max: 3 }, { count: 2, min: 1, max: 3 }, { min: 1, extra: true }, null, []])('rejects malformed repeat %j in schema and runtime', repeat => {
  const value = algorithmKnot({ repeat })
  expect(knot(value)).toBe(false)
  expect(validateKnot(value).valid).toBe(false)
})
it('checks repeat range ordering semantically beyond standard JSON Schema', () => {
  const value = algorithmKnot({ repeat: { min: 4, max: 2 } })
  expect(knot(value)).toBe(true)
  const result = validateKnot(value)
  expect(result.valid).toBe(false)
  if (!result.valid) expect(result.issues).toContainEqual(expect.objectContaining({ path: 'algorithms.guide.steps.first.repeat', message: 'Repeat min must not exceed max' }))
})
it.each(['tying', 'untying', 'transformation', 'adjustment', undefined])('accepts optional algorithm purpose %j', purpose => {
  const value = algorithmKnot({ condition: [{ language: 'en', value: 'If needed.' }, { language: 'uk', value: 'За потреби.' }] }, purpose)
  expect(knot(value), JSON.stringify(knot.errors)).toBe(true)
  expect(validateKnot(value)).toMatchObject({ valid: true, complete: true })
})
it.each(['other', '', null, [], 1])('rejects invalid algorithm purpose %j', purpose => {
  const value = algorithmKnot({}, purpose)
  expect(knot(value)).toBe(false)
  expect(validateKnot(value).valid).toBe(false)
})
it.each([[], 'If needed.', true, [{ language: 'en', value: '' }], [{ value: 'If needed.' }], [{ language: 'en', value: 'If needed.', extra: true }], Array.from({ length: 129 }, () => ({ language: 'en', value: 'If needed.' }))])('rejects malformed condition %#', condition => {
  const value = algorithmKnot({ condition })
  expect(knot(value)).toBe(false)
  expect(validateKnot(value).valid).toBe(false)
})
for(const f of readdirSync('v1/examples/knots').filter(f=>f.endsWith('.json')))it(`schema/runtime align for ${f}`,()=>{
  const data=JSON.parse(readFileSync(`v1/examples/knots/${f}`,'utf8'))
  expect(knot(data),JSON.stringify(knot.errors)).toBe(true)
  for(const rep of normalizeKnot(data).representations!){const validate=rep.type.endsWith('/2d')?geometry2d:rep.type.endsWith('/3d')?geometry3d:rep.type.endsWith('mosaic-diagram')?mosaic:rep.type.endsWith('pd-code')?pd:rep.type.endsWith('dt-code')?dt:grid;expect(validate(rep.data),JSON.stringify(validate.errors)).toBe(true)}
  expect(validateKnot(data).valid).toBe(true)
})
it('schemas reject old envelope, unknown fields and invalid standalone data',()=>{
  expect(knot({schemaVersion:1,units:'m',elements:[],representations:[]})).toBe(false)
  expect(grid({encoding:'xo',size:2,x:[0,1],o:[1,0],extra:1})).toBe(false)
  expect(grid({encoding:'xo',size:2,x:[0.5,1],o:[1,0]})).toBe(false)
})
it('accepts algorithms and rejects the former procedures collection in schema and runtime', () => {
  const base = { schema: 'Knot', schemaVersion: 1, id: 'guide', subject: { id: 'rope' } }
  const algorithms = [{ id: 'tie', steps: [{ id: 'first' }] }]
  const current = { ...base, algorithms }
  expect(knot(current), JSON.stringify(knot.errors)).toBe(true)
  expect(validateKnot(current)).toMatchObject({ valid: true, complete: true })
  for (const legacy of [{ ...base, procedures: algorithms }, { ...current, procedures: [] }]) {
    expect(knot(legacy)).toBe(false)
    expect(validateKnot(legacy).valid).toBe(false)
  }
})
it('publishes independent compilable schemas and exact resource-kind dispatch',()=>{
  for(const file of readdirSync('v1/schema').filter(f=>f.endsWith('.json'))) {
    const schema=JSON.parse(readFileSync(`v1/schema/${file}`,'utf8'))
    expect(()=>new Ajv2020({strict:false}).compile(schema),file).not.toThrow()
  }
  const schema=JSON.parse(readFileSync('v1/schema/resource.schema.json','utf8'))
  const check=new Ajv2020({strict:false}).compile(schema)
  expect(check({schema:'ResourceDocument',schemaVersion:1,kind:'view',resource:{id:'urn:example:bad'}})).toBe(false)
})

it('accepts localized subject names and descriptions but rejects malformed records',()=>{
  const a=JSON.parse(readFileSync('v1/examples/knots/overhand.json','utf8'))
  expect(knot(a)).toBe(true)
  expect(validateKnot(a).valid).toBe(true)
  a.subject.descriptions=[{language:'uk',value:''}]
  expect(knot(a)).toBe(false)
  expect(validateKnot(a).valid).toBe(false)
  a.subject.descriptions=[{language:'uk',value:'Опис',extra:true}]
  expect(knot(a)).toBe(false)
})
