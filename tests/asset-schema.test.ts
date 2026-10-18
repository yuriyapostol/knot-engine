import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import { readFileSync,readdirSync } from 'node:fs'
import assetSchema from '../v1/spec/schema/knot-asset.schema.json'
import spatialSchema from '../v1/spec/schema/spatial-curve.schema.json'
import mosaicSchema from '../v1/spec/schema/mosaic-diagram.schema.json'
import dtSchema from '../v1/spec/schema/dt-code.schema.json'
import pdSchema from '../v1/spec/schema/pd-code.schema.json'
import gridSchema from '../v1/spec/schema/grid-diagram.schema.json'
import { validateKnotAsset } from '../src/core'
const ajv=new Ajv2020({strict:false}),asset=ajv.compile(assetSchema),spatial=ajv.compile(spatialSchema),grid=ajv.compile(gridSchema),mosaic=ajv.compile(mosaicSchema),pd=ajv.compile(pdSchema),dt=ajv.compile(dtSchema)
for(const f of readdirSync('v1/spec/examples/assets').filter(f=>f.endsWith('.json')))it(`schema/runtime align for ${f}`,()=>{
  const data=JSON.parse(readFileSync(`v1/spec/examples/assets/${f}`,'utf8'))
  expect(asset(data),JSON.stringify(asset.errors)).toBe(true)
  for(const rep of data.representations){const validate=rep.type.endsWith('spatial-curve')?spatial:rep.type.endsWith('mosaic-diagram')?mosaic:rep.type.endsWith('pd-code')?pd:rep.type.endsWith('dt-code')?dt:grid;expect(validate(rep.data),JSON.stringify(validate.errors)).toBe(true)}
  expect(validateKnotAsset(data).valid).toBe(true)
})
it('schemas reject old envelope, unknown fields and invalid standalone data',()=>{
  expect(asset({schemaVersion:1,units:'m',elements:[],representations:[]})).toBe(false)
  expect(grid({encoding:'xo',size:2,x:[0,1],o:[1,0],extra:1})).toBe(false)
  expect(grid({encoding:'xo',size:2,x:[0.5,1],o:[1,0]})).toBe(false)
})
it('publishes independent compilable schemas and exact resource-kind dispatch',()=>{
  for(const file of readdirSync('v1/spec/schema').filter(f=>f.endsWith('.json'))) {
    const schema=JSON.parse(readFileSync(`v1/spec/schema/${file}`,'utf8'))
    expect(()=>new Ajv2020({strict:false}).compile(schema),file).not.toThrow()
  }
  const schema=JSON.parse(readFileSync('v1/spec/schema/knot-resource.schema.json','utf8'))
  const check=new Ajv2020({strict:false}).compile(schema)
  expect(check({schema:'KnotResourceDocument',schemaVersion:1,kind:'view',resource:{id:'urn:example:bad'}})).toBe(false)
})
