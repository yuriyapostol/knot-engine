import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateKnot, validateRepresentationDocument, validateResourceDocument, validateResourceRegistry, selectKnot, composeKnot, STANDARD_RESOURCES, type RawKnot, type RawResourceRegistry } from '../src/core'
const source={id:'book',title:'Example publication',authors:[{name:'Original Author',email:'author@example.org'}],license:{name:'Source terms',url:'https://example.org/terms'},note:'Source-level note'}
const contribution={name:'Editor',email:'editor@example.org',url:'https://example.org/editor',roles:['editing','validation'],date:'2026-10-18',note:'Corrected and checked data'}
function knot(): RawKnot {
  const a=JSON.parse(readFileSync('v1/examples/knots/pd-trefoil.json','utf8'))
  a.sources=[source,{id:'unused',title:'Unused'}];a.contributions=[contribution];a.license={name:'Example license',url:'https://example.org/license'}
  a.representations[0].sources=[{id:'book',locator:'Page 12',accessed:'2026-10-18',note:'Imported this table'}]
  a.representations[0].contributions=[contribution]
  return a
}
it('keeps optional metadata separate from geometric data and accepts it for every representation type',()=>{
  for(const name of ['open-rope','grid-diagram','grid-vertex-pairs','mosaic-diagram','pd-trefoil','dt-trefoil']) {
    const a=JSON.parse(readFileSync(`v1/examples/knots/${name}.json`,'utf8'))
    a.representations[0].sources=[{title:'Own measurements',authors:[{name:'Team'}],note:'Measured by the author'}]
    a.representations[0].contributions=[{name:'Team',note:'Created data'}]
    expect(validateKnot(a)).toMatchObject({valid:true,complete:true})
  }
  expect(validateKnot(knot())).toMatchObject({valid:true,complete:true})
  const a=knot();a.representations![0].sources=[{url:'https://example.org/data'}]
  expect(validateKnot(a)).toMatchObject({valid:true,complete:true})
})
it('retains required sources and both contribution levels and license in selected/composed fragments',()=>{
  const a=knot(),before=JSON.stringify(a)
  const part=selectKnot(a,{representations:['pd']})
  expect(part.sources).toEqual([source]);expect(part.license).toEqual(a.license);expect(part.contributions).toEqual(a.contributions)
  expect(part.representations![0].contributions).toEqual(a.representations![0].contributions)
  expect(part.representations![0].sources).toEqual(a.representations![0].sources)
  expect(JSON.stringify(a)).toBe(before)
  expect(composeKnot([part,part]).contributions).toHaveLength(1)
  const second=structuredClone(part);second.representations=[];second.contributions=[{name:'Another editor',roles:['editing']}]
  expect(composeKnot([part,second]).contributions).toHaveLength(2)
  const conflict=structuredClone(second);conflict.license={name:'Different license'}
  expect(()=>composeKnot([part,conflict])).toThrow(/license/)
  const sourceConflict=structuredClone(second);sourceConflict.sources![0].title='Different source'
  expect(()=>composeKnot([part,sourceConflict])).toThrow(/sources/)
  const absent=structuredClone(second);delete absent.license
  expect(composeKnot([absent,part]).license).toEqual(part.license)
})
it('supports standalone representation documents with source definitions',()=>{
  const a=knot()
  expect(validateRepresentationDocument({schema:'RawRepresentationDocument',schemaVersion:1,namespaces:a.namespaces,sources:a.sources,representation:a.representations![0]}, {registries:[STANDARD_RESOURCES]})).toMatchObject({valid:true,complete:true})
})
it('resolves only explicit source resource references and normalizes IDs without rewriting URLs',()=>{
  const a=knot(),global={...source,id:'https://example.org/sources/book'}
  a.sources=[global];a.namespaces={...a.namespaces,ex:'https://example.org/sources/'}
  a.representations![0].sources=[{id:'ex:book'},{ref:'ex:book',note:'Local context'}]
  expect(validateKnot(a)).toMatchObject({valid:true,complete:true})
  expect(selectKnot(a,{representations:['pd']}).sources).toHaveLength(1)
  a.sources=[]
  a.representations![0].sources=[{ref:'ex:book'}]
  expect(validateKnot(a)).toMatchObject({valid:true,complete:false,missingDependencies:[{kind:'source',ref:global.id}]})
  const registry: RawResourceRegistry={schema: 'ResourceRegistry',schemaVersion:1,resources:[{kind:'source',resource:global}]}
  const options={registries:[registry]}
  expect(validateResourceRegistry(registry).valid).toBe(true)
  expect(validateResourceDocument({schema:'RawResourceDocument',schemaVersion:1,kind:'source',resource:global}).valid).toBe(true)
  const selected=selectKnot(a,{representations:['pd']},options)
  expect(selected.sources).toEqual([global]);expect(validateKnot(selected)).toMatchObject({valid:true,complete:true})
  a.representations![0].sources=[{id:'missing'}]
  expect(validateKnot(a).valid).toBe(false)
  a.representations![0].sources=[{ref:a.representations![0].type}]
  expect(validateKnot(a).valid).toBe(false)
})
it('rejects malformed metadata, impossible dates, conflicts and fields at unsupported levels',()=>{
  const changes=[{sources:[{id:'s'}]},{sources:[{id:'s',title:' '}]},{sources:[source,source]},{contributions:[{name:' '}]},{contributions:[{name:'Editor',roles:[]}]},{contributions:[{name:'Editor',roles:['unknown']}]},{contributions:[{name:'Editor',roles:['editing','editing']}]},{contributions:[{name:'Editor',date:'2026-02-30'}]},{contributions:[{name:'Editor',email:'invalid'}]},{license:{name:' '}},{license:{name:'License',url:'javascript:alert(1)'}}]
  for(const change of changes)expect(validateKnot({...knot(),...change}).valid).toBe(false)
  for(const sources of [[{title:'A',accessed:'2026-02-29'}],[{id:'book',title:'Mixed reference'}],[{ref:'urn:a',id:'b'}],[{title:'A',url:'https://['}],[{title:'A',url:'relative/path'}]]) {
    const a=knot();a.representations![0].sources=sources as never
    expect(validateKnot(a).valid).toBe(false)
  }
  const leap=knot();leap.contributions=[{name:'Editor',date:'2024-02-29'}]
  expect(validateKnot(leap).valid).toBe(true)
  const a=knot();Object.assign(a.representations![0],{license:{name:'Not supported'}})
  expect(validateKnot(a).valid).toBe(false)
})
