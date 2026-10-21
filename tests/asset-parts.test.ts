import { expect, it } from 'vitest'
import multi from '../v1/examples/assets/procedures.json'
import grid from '../v1/examples/assets/grid-diagram.json'
import { selectKnotAsset, composeKnotAsset, validateKnotAsset, STANDARD_RESOURCES } from '../src/core'
it('extracts a procedure with its representations, construction and type definitions',()=>{
  const source=structuredClone(multi)
  const part=selectKnotAsset(source,{procedures:['sequence-b']})
  expect(part.representations).toHaveLength(2)
  expect(part.procedures).toHaveLength(1)
  expect(part.constructions).toHaveLength(1)
  expect(part.objectTypes).toHaveLength(1)
  expect(validateKnotAsset(part)).toMatchObject({valid:true,complete:true})
  part.subject.id='different';expect(source.subject.id).not.toBe('different')
})
it('composes fragments of the same document and detects conflicts',()=>{
  const a=selectKnotAsset(multi,{representations:[multi.representations[0].id]})
  const b=selectKnotAsset(multi,{representations:[multi.representations[1].id]})
  expect(composeKnotAsset([a,b]).representations).toHaveLength(2)
  expect(composeKnotAsset([a,a]).representations).toHaveLength(1)
  expect(()=>composeKnotAsset([a,grid])).toThrow()
  const conflict=structuredClone(a);conflict.representations![0].data = { ...conflict.representations![0].data as object, curves: [...(conflict.representations![0].data as { curves: unknown[] }).curves].reverse() }
  expect(()=>composeKnotAsset([a,conflict])).toThrow(/Conflicting/)
  expect(()=>selectKnotAsset(a,{representations:['missing']})).toThrow()
})
it('includes externally supplied type definitions and no unrelated registry entries',()=>{
  const a=structuredClone(grid);a.representationTypes=[]
  const part=selectKnotAsset(a,{representations:['grid']},{registries:[STANDARD_RESOURCES]})
  expect(part.representationTypes).toHaveLength(1)
  expect(part.objectTypes).toBeUndefined()
  expect(validateKnotAsset(part)).toMatchObject({valid:true,complete:true})
})
it('closes external construction dependencies without copying viewer presets',()=>{
  const a=structuredClone(multi)
  const construction={...a.constructions[0],id:'urn:example:setup'}
  const rep={...a.representations[0],target:{kind:'state' as const,construction:{ref:construction.id},id:a.representations[0].target.id}}
  const asset={schema:'KnotAsset',schemaVersion:1,namespaces:a.namespaces,id:'external',subject:{id:'s'},representations:[rep]}
  const registry:import('../src/core').KnotResourceRegistry={schema:'KnotResourceRegistry',schemaVersion:1,namespaces:STANDARD_RESOURCES.namespaces,resources:[...STANDARD_RESOURCES.resources,{kind:'construction',resource:construction}]}
  const part=selectKnotAsset(asset,{representations:[rep.id]},{registries:[registry]})
  expect(validateKnotAsset(part)).toMatchObject({valid:true,complete:true})
  expect(part.constructions).toHaveLength(1)
  expect(part.objectTypes).toHaveLength(1)
  expect(part.representations![0]).not.toHaveProperty('views')
})
