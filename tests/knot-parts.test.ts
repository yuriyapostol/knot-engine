import { selectKnot } from '../src/core/knotParts'
import { composeKnot } from '../src/core/knotParts'
import { validateKnot } from '../src/core/validateKnot'
import { expect, it } from 'vitest'
import multi from '../v1/examples/knots/procedures.json'
import grid from '../v1/examples/knots/grid-diagram.json'
import { STANDARD_RESOURCES } from '../src/core'
it('extracts a procedure with its representations, construction and type definitions',()=>{
  const source=structuredClone(multi)
  const part=selectKnot(source,{procedures:['sequence-b']})
  expect(part.representations).toHaveLength(2)
  expect(part.procedures).toHaveLength(1)
  expect(part.constructions).toHaveLength(1)
  expect(part.objectTypes).toHaveLength(1)
  expect(validateKnot(part)).toMatchObject({valid:true,complete:true})
  part.subject.id='different';expect(source.subject.id).not.toBe('different')
})
it('composes fragments of the same document and detects conflicts',()=>{
  const a=selectKnot(multi,{representations:[multi.representations[0].id]})
  const b=selectKnot(multi,{representations:[multi.representations[1].id]})
  expect(composeKnot([a,b]).representations).toHaveLength(2)
  expect(composeKnot([a,a]).representations).toHaveLength(1)
  expect(()=>composeKnot([a,grid])).toThrow()
  const conflict=structuredClone(a);(conflict.representations![0].data as { elements: { points: number[][] }[] }).elements[0].points[1][0] += 0.01
  expect(()=>composeKnot([a,conflict])).toThrow(/Conflicting/)
  expect(()=>selectKnot(a,{representations:['missing']})).toThrow()
})
it('includes externally supplied type definitions and no unrelated registry entries',()=>{
  const a=structuredClone(grid);a.representationTypes=[]
  const part=selectKnot(a,{representations:['grid']},{registries:[STANDARD_RESOURCES]})
  expect(part.representationTypes).toHaveLength(1)
  expect(part.objectTypes).toBeUndefined()
  expect(validateKnot(part)).toMatchObject({valid:true,complete:true})
})
it('closes external construction dependencies without copying viewer presets',()=>{
  const a=structuredClone(multi)
  const construction={...a.constructions[0],id:'urn:example:setup'}
  const rep={...a.representations[0],target:{kind:'state' as const,construction:{ref:construction.id},id:a.representations[0].target.id}}
  const knot={schema:'Knot',schemaVersion:1,namespaces:a.namespaces,id:'external',subject:{id:'s'},representations:[rep]}
  const registry:import('../src/core').RawResourceRegistry={schema: 'ResourceRegistry',schemaVersion:1,namespaces:STANDARD_RESOURCES.namespaces,resources:[...STANDARD_RESOURCES.resources,{kind:'construction',resource:construction}]}
  const part=selectKnot(knot,{representations:[rep.id]},{registries:[registry]})
  expect(validateKnot(part)).toMatchObject({valid:true,complete:true})
  expect(part.constructions).toHaveLength(1)
  expect(part.objectTypes).toHaveLength(1)
  expect(part.representations![0]).not.toHaveProperty('views')
})
