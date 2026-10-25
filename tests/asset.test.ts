import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import open from '../v1/examples/assets/open-rope.json'
import multi from '../v1/examples/assets/procedures.json'
import { validateAsset, resolveAsset, validateGridDiagram, validateSpatialCurve, validateView, STANDARD_RESOURCES, expandURI, validateResourceRegistry, validateResourceDocument, validateRepresentationDocument, SPATIAL_CURVE, type RawAsset } from '../src/core'
const copy = () => structuredClone(open)
describe('RawAsset generation 1', () => {
  for(const file of readdirSync('v1/examples/assets').filter(f=>f.endsWith('.json'))) it(`validates ${file}`,()=>{
    const value=JSON.parse(readFileSync(`v1/examples/assets/${file}`,'utf8'))
    const result=validateAsset(value)
    expect(result,JSON.stringify(result)).toMatchObject({valid:true,complete:true})
  })
  for(const file of readdirSync('v1/examples/assets/invalid')) it(`rejects ${file}`,()=>expect(validateAsset(JSON.parse(readFileSync(`v1/examples/assets/invalid/${file}`,'utf8'))).valid).toBe(false))
  it('accepts metadata-only documents and rejects old roots',()=>{
    expect(validateAsset({schema:'Asset',schemaVersion:1,id:'document',subject:{id:'subject'}})).toMatchObject({valid:true,complete:true})
    expect(validateAsset({schemaVersion:1,curves:[]} ).valid).toBe(false)
    expect(validateAsset({...open,units:'m'}).valid).toBe(false)
  })
  it('does not mutate frozen input and copies resolved geometry',()=>{
    const a=copy(), before=JSON.stringify(a)
    const freeze=(v:unknown)=>{if(v && typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}}
    freeze(a)
    const r=resolveAsset(a);r.curves[0].points[0][0]=123
    expect(JSON.stringify(a)).toBe(before)
  })
  it('keeps procedures independent of interpolation point counts',()=>{
    const a=structuredClone(multi)
    a.representations[1].data.curves[0].points.push([2,3,4])
    expect(validateAsset(a)).toMatchObject({valid:true,complete:true})
    a.procedures[0].steps[0].representations[0].id='missing'
    expect(validateAsset(a).valid).toBe(false)
  })
  it('reports missing dependencies separately from validity',()=>{
    const a=copy();a.representationTypes=[]
    expect(validateAsset(a)).toMatchObject({valid:true,complete:false,missingDependencies:[{kind:'representation-type',ref:SPATIAL_CURVE}]})
    expect(validateAsset(a,{registries:[STANDARD_RESOURCES]})).toMatchObject({valid:true,complete:true})
    expect(()=>resolveAsset(a)).toThrow(/Incomplete/)
  })
  it('retains unknown extensions as unchecked, never claims renderer support',()=>{
    const a={schema:'Asset',schemaVersion:1,id:'a',subject:{id:'s'},representations:[{id:'r',type:'urn:example:custom',data:{x:1}}]}
    expect(validateAsset(a)).toMatchObject({valid:true,complete:false,uncheckedTypes:['urn:example:custom']})
  })
  it('validates supplied inline schemas without loading URI references',()=>{
    const definition={id:'urn:example:custom',name:'Custom',description:'Custom data',specification:'urn:example:spec',dataSchema:{inline:{$schema:'https://json-schema.org/draft/2020-12/schema',type:'integer'}}}
    const a={schema:'Asset',schemaVersion:1,id:'a',subject:{id:'s'},representationTypes:[definition],representations:[{id:'r',type:definition.id,data:'bad'}]}
    expect(validateAsset(a).valid).toBe(false)
    expect(validateAsset({...a,representations:[{...a.representations[0],data:3}]})).toMatchObject({valid:true,complete:false})
  })
  it('rejects conflicts between embedded and explicitly provided resources',()=>{
    const a=copy();a.representationTypes[0].description='conflict'
    expect(validateAsset(a,{registries:[STANDARD_RESOURCES]}).valid).toBe(false)
  })
  it('expands only declared prefixes and rejects reserved names',()=>{
    expect(expandURI('k:thing',{k:'urn:example:'})).toBe('urn:example:thing')
    expect(()=>expandURI('typo:thing')).toThrow()
    expect(validateAsset({...open,namespaces:{https:'urn:example:'}}).valid).toBe(false)
    const a=copy();a.representations[0].type='k:representation-types/spatial-curve'
    expect(validateAsset({...a,namespaces:{...a.namespaces,k:'https://yuriyapostol.github.io/knot-engine/v1/'}}).valid).toBe(true)
  })
  it('checks all representations, object and state scopes',()=>{
    const a=copy();a.representations[0].target.id='missing'
    expect(validateAsset(a).valid).toBe(false)
    const b=copy();b.constructions[0].objects.push(structuredClone(b.constructions[0].objects[0]))
    expect(validateAsset(b).valid).toBe(false)
    const c=copy();c.constructions[0].objects[0].ends[1].id=c.constructions[0].objects[0].ends[0].id
    expect(validateAsset(c).valid).toBe(false)
  })
  it('rejects cycles, nonfinite numbers, deep/oversized arrays and accessors before validation',()=>{
    for(const n of [NaN,Infinity,-Infinity]) {const a=copy();a.representations[0].data.curves[0].points[0][0]=n;expect(validateAsset(a).valid).toBe(false)}
    const cyclic:Record<string,unknown>={};cyclic.self=cyclic
    expect(validateAsset(cyclic).valid).toBe(false)
    let deep:unknown={};for(let i=0;i<70;i++)deep={deep}
    expect(validateAsset(deep)).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
    expect(validateAsset(new Array(300000).fill(null))).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
    expect(validateAsset({get schema(){throw new Error('must not run')}}).valid).toBe(false)
  })
  it('separates domain coordinates from renderer limits',()=>{
    const a=copy();a.representations[0].data.curves[0].points[0][0]=2e6
    expect(validateAsset(a).valid).toBe(true)
    expect(()=>resolveAsset(a)).toThrow(/1000000/)
  })
  it('converts physical diameter into data units, relative coordinates use display thickness',()=>{
    const a=copy();a.representations[0].data.coordinateSystem.scale.metersPerUnit=0.01
    expect(resolveAsset(a).curves[0].radius).toBe(a.constructions[0].objects[0].diameter/0.02)
    const b=copy() as unknown as RawAsset
    const data=b.representations![0].data as import('../src/core').SpatialCurveData
    data.coordinateSystem.scale={kind:'relative'}
    expect(resolveAsset(b).warnings.length).toBeGreaterThan(0)
  })
})
describe('independent contracts',()=>{
  it('validates Grid X/O without an asset',()=>{
    const grid={encoding:'xo',size:2,x:[0,1],o:[1,0]}
    expect(validateGridDiagram(grid).valid).toBe(true)
    for(const change of [{x:[0,0]},{o:[0,1]},{x:[0,2]},{size:3}])expect(validateGridDiagram({...grid,...change}).valid).toBe(false)
  })
  it('checks curve closure and exact repeated points for each interpolation',()=>{
    const data=copy().representations[0].data
    expect(validateSpatialCurve(data).valid).toBe(true)
    data.curves[0].points[1]=data.curves[0].points[0]
    expect(validateSpatialCurve(data).valid).toBe(false)
    const closed=copy().representations[0].data;closed.curves[0].closed=true;closed.curves[0].points=[ [0,0,0],[1,0,0] ]
    expect(validateSpatialCurve(closed).valid).toBe(false)
  })
  it('validates camera modes and vector/projection constraints',()=>{
    const view={id:'front',name:'Front',space:'space',camera:{mode:'fit',direction:[0,0,1],up:[0,1,0],projection:{kind:'orthographic'}}}
    expect(validateView(view).valid).toBe(true)
    expect(validateView({...view,camera:{...view.camera,up:[0,0,2]}}).valid).toBe(false)
    expect(validateView({...view,camera:{...view.camera,projection:{kind:'perspective',fovY:180}}}).valid).toBe(false)
  })
  it('validates resource registry/document and standalone representation',()=>{
    expect(validateResourceRegistry(STANDARD_RESOURCES).valid).toBe(true)
    expect(validateResourceDocument({schema:'KnotResourceDocument',schemaVersion:1,namespaces:STANDARD_RESOURCES.namespaces,...STANDARD_RESOURCES.resources[0]}).valid).toBe(true)
    const rep={id:'grid',type:'https://yuriyapostol.github.io/knot-engine/v1/representation-types/grid-diagram',data:{encoding:'xo',size:2,x:[0,1],o:[1,0]}}
    expect(validateRepresentationDocument({schema:'KnotRepresentationDocument',schemaVersion:1,representation:rep},{registries:[STANDARD_RESOURCES]})).toMatchObject({valid:true,complete:true})
  })
})
it('validates all schema wrappers and dependency scopes without network access',()=>{
  const resource={schema:'KnotResourceDocument',schemaVersion:1,kind:'catalog',resource:{id:'urn:test:catalog',name:'Catalog',description:'Test'}}
  expect(validateResourceDocument({...resource,resource:{...resource.resource,unexpected:true}}).valid).toBe(false)
  expect(validateResourceDocument({...resource,resource:{...resource.resource,id:'local-only'}}).valid).toBe(false)
  const a=copy();a.constructions[0].objects[0].ends[0].id='a';a.constructions[0].objects[0].ends[1].id='b'
  const second=structuredClone(a.constructions[0]);second.id='second'
  a.constructions.push(second)
  expect(validateAsset(a).valid).toBe(true)
})
it('keeps missing custom schema references incomplete without fetching',()=>{
  const type={id:'urn:example:custom',name:'Custom',description:'Test',specification:'urn:example:spec',dataSchema:{inline:{$schema:'https://json-schema.org/draft/2020-12/schema',$ref:'https://example.invalid/unavailable.schema.json'}}}
  const a={schema:'Asset',schemaVersion:1,id:'a',subject:{id:'s'},representationTypes:[type],representations:[{id:'r',type:type.id,data:{}}]}
  expect(validateAsset(a)).toMatchObject({valid:true,complete:false,uncheckedTypes:[type.id]})
})
