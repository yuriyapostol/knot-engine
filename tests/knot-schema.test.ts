import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import { readFileSync,readdirSync } from 'node:fs'
import knotSchema from '../v1/schema/knot.schema.json'
import spatialSchema from '../v1/schema/spatial-curve.schema.json'
import mosaicSchema from '../v1/schema/mosaic-diagram.schema.json'
import dtSchema from '../v1/schema/dt-code.schema.json'
import pdSchema from '../v1/schema/pd-code.schema.json'
import gridSchema from '../v1/schema/grid-diagram.schema.json'
import { validateKnot } from '../src/core'
import { normalizeKnot } from '../src/core/validateKnot'
const ajv=new Ajv2020({strict:false}),knot=ajv.compile(knotSchema),spatial=ajv.compile(spatialSchema),grid=ajv.compile(gridSchema),mosaic=ajv.compile(mosaicSchema),pd=ajv.compile(pdSchema),dt=ajv.compile(dtSchema)
for(const f of readdirSync('v1/examples/knots').filter(f=>f.endsWith('.json')))it(`schema/runtime align for ${f}`,()=>{
  const data=JSON.parse(readFileSync(`v1/examples/knots/${f}`,'utf8'))
  expect(knot(data),JSON.stringify(knot.errors)).toBe(true)
  for(const rep of normalizeKnot(data).representations!){const validate=rep.type.endsWith('spatial-curve')?spatial:rep.type.endsWith('mosaic-diagram')?mosaic:rep.type.endsWith('pd-code')?pd:rep.type.endsWith('dt-code')?dt:grid;expect(validate(rep.data),JSON.stringify(validate.errors)).toBe(true)}
  expect(validateKnot(data).valid).toBe(true)
})
it('schemas reject old envelope, unknown fields and invalid standalone data',()=>{
  expect(knot({schemaVersion:1,units:'m',elements:[],representations:[]})).toBe(false)
  expect(grid({encoding:'xo',size:2,x:[0,1],o:[1,0],extra:1})).toBe(false)
  expect(grid({encoding:'xo',size:2,x:[0.5,1],o:[1,0]})).toBe(false)
})
it('publishes independent compilable schemas and exact resource-kind dispatch',()=>{
  for(const file of readdirSync('v1/schema').filter(f=>f.endsWith('.json'))) {
    const schema=JSON.parse(readFileSync(`v1/schema/${file}`,'utf8'))
    expect(()=>new Ajv2020({strict:false}).compile(schema),file).not.toThrow()
  }
  const schema=JSON.parse(readFileSync('v1/schema/knot-resource.schema.json','utf8'))
  const check=new Ajv2020({strict:false}).compile(schema)
  expect(check({schema:'RawResourceDocument',schemaVersion:1,kind:'view',resource:{id:'urn:example:bad'}})).toBe(false)
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
