import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../v1/spec/schema/mosaic-diagram.schema.json'
import { validateMosaicDiagram, LOMONACO_KAUFFMAN_11 as tileSet, MOSAIC_DIAGRAM, STANDARD_RESOURCES, validateKnotAsset, validateRepresentationDocument, selectKnotAsset, composeKnotAsset } from '../src/core'
const loop = [[2,1],[3,4]]
const source = [[0,2,1,0],[2,9,10,1],[3,10,8,4],[0,3,4,0]]
const data = (tiles: number[][]) => ({ tileSet, tiles })
const asset = {schema:'KnotAsset',schemaVersion:1,id:'mosaic',subject:{id:'s'},representations:[{id:'m',type:MOSAIC_DIAGRAM,data:data(source)}]}
it('traces loops, separate components and crossing strands', () => {
  expect(validateMosaicDiagram(data(loop))).toMatchObject({valid:true,componentCount:1,occupiedTileCount:4,crossingCount:0})
  expect(validateMosaicDiagram(data([[2,1,2,1],[3,4,3,4],[0,0,0,0],[0,0,0,0]]))).toMatchObject({valid:true,componentCount:2})
  expect(validateMosaicDiagram(data(source))).toMatchObject({valid:true,componentCount:1,occupiedTileCount:12,crossingCount:3})
  expect(validateMosaicDiagram(data(source.map(row=>row.map(t=>t===9?10:t===10?9:t))))).toMatchObject({valid:true,componentCount:1,crossingCount:3})
  const rotated = [0,4,1,2,3,6,5,8,7,10,9]
  expect(validateMosaicDiagram(data(source.map((_,r)=>source.map((_,c)=>rotated[source[3-c][r]]))))).toMatchObject({valid:true,componentCount:1,crossingCount:3})
  expect(validateMosaicDiagram(data([[2,1,0],[3,7,1],[0,3,4]]))).toMatchObject({valid:true,componentCount:1,crossingCount:0})
})
it('rejects malformed JSON, unsupported profiles, open boundaries and mismatches', () => {
  for(const tiles of [[],[[0]],[[2],[3,4]],[[11]],[[1.5]],[[1,1],[3,4]],[[2,1],[3,0]],[[NaN]],[[Infinity]], [Array(2),[3,4]]]) expect(validateMosaicDiagram(data(tiles)).valid).toBe(false)
  for(const bad of [{...data(loop),tileSet:'tiles:lomonaco-kauffman-11'},{...data(loop),extra:1},null]) expect(validateMosaicDiagram(bad).valid).toBe(false)
  const check = new Ajv2020({strict:false}).compile(schema)
  expect(check(data(loop))).toBe(true)
  expect(check(data([[11]]))).toBe(false)
  expect(check(data([[0]]))).toBe(true) // structural schema is deliberately weaker
})
it('bounds cells before tracing', () => {
  expect(validateMosaicDiagram(data(Array.from({length:257},()=>Array(257).fill(0))))).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
})
it('integrates completeness, compact type names, plane views and standalone documents', () => {
  const options={registries:[STANDARD_RESOURCES]}
  expect(validateKnotAsset(asset,options)).toMatchObject({valid:true,complete:true,uncheckedTypes:[]})
  expect(validateKnotAsset(asset)).toMatchObject({valid:true,complete:false,uncheckedTypes:[]})
  expect(validateKnotAsset({...asset,namespaces:{k:'https://yuriyapostol.github.io/knot-engine/v1/representation-types/'},representations:[{...asset.representations[0],type:'k:mosaic-diagram'}]},options)).toMatchObject({valid:true,complete:true})
  const rep={...asset.representations[0],views:[{id:'front',name:'Front',space:'plane',camera:{mode:'plane',center:[2,2],height:4,rotation:0}}]}
  expect(validateRepresentationDocument({schema:'KnotRepresentationDocument',schemaVersion:1,representation:rep},options)).toMatchObject({valid:true,complete:true})
  expect(validateKnotAsset({...asset,representations:[{...rep,preferredView:{direction:[0,0,1],up:[0,1,0]}}]},options).valid).toBe(false)
  const part=selectKnotAsset(asset,{representations:['m']},options)
  expect(validateKnotAsset(part)).toMatchObject({valid:true,complete:true})
  expect(JSON.parse(JSON.stringify(composeKnotAsset([part,part]))).representations[0].data).toEqual(data(source))
})
it('preserves both disjoint-arc tiles under reflection and enforces aggregate budget', () => {
  const joined=[[2,1,0],[3,7,1],[0,3,4]]
  const mirror=[0,2,1,4,3,5,6,8,7,9,10]
  expect(validateMosaicDiagram(data(joined.map(row=>[...row].reverse().map(t=>mirror[t]))))).toMatchObject({valid:true,componentCount:1,crossingCount:0})
  const large=Array.from({length:182},()=>Array(182).fill(0));large[0][0]=2;large[0][1]=1;large[1][0]=3;large[1][1]=4
  expect(validateMosaicDiagram(data(large)).valid).toBe(true)
  expect(validateKnotAsset({...asset,representations:['a','b'].map(id=>({id,type:MOSAIC_DIAGRAM,data:data(large)}))},{registries:[STANDARD_RESOURCES]})).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
})
