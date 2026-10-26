import { validateKnot } from '../src/core/validateKnot'
import { selectKnot } from '../src/core/knotParts'
import { composeKnot } from '../src/core/knotParts'
import { resolveKnot } from '../src/core/resolve'
import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../v1/schema/pd-code.schema.json'
import { PD_CODE, ROPE_TYPE, PD_CCW_UNDER_FIRST as convention, validatePDCode, validateRepresentationDocument, STANDARD_RESOURCES } from '../src/core'
const trefoil = [[1,5,2,4],[3,1,4,6],[5,3,6,2]]
const link = [[6,1,7,2],[8,3,5,4],[2,5,3,6],[4,7,1,8]]
const pd=(crossings:number[][],unlinkedComponents?:number)=>({convention,crossings,...(unlinkedComponents===undefined?{}:{unlinkedComponents})})
const options={registries:[STANDARD_RESOURCES]}
const knot=(data:unknown)=>({schema:'Knot',schemaVersion:1,id:'pd',subject:{id:'s'},representations:[{id:'pd',type:PD_CODE,data}]})
it('checks sourced knot and link examples, mirrors, split diagrams and crossing-free components',()=>{
  expect(validatePDCode(pd(trefoil))).toMatchObject({valid:true,componentCount:1,crossingCount:3})
  expect(validatePDCode(pd(link))).toMatchObject({valid:true,componentCount:2,crossingCount:4})
  expect(validatePDCode(pd(trefoil.map(([a,b,c,d])=>[a,d,c,b])))).toMatchObject({valid:true,componentCount:1,crossingCount:3})
  expect(validatePDCode(pd([[1,1,2,2],[3,3,4,4]],1))).toMatchObject({valid:true,componentCount:3,crossingCount:2})
  expect(validatePDCode(pd([],1))).toMatchObject({valid:true,componentCount:1,crossingCount:0})
  expect(validatePDCode(pd([],3))).toMatchObject({valid:true,componentCount:3})
  expect(validatePDCode(pd([[4,2,5,1],[8,6,1,5],[6,3,7,4],[2,7,3,8]]))).toMatchObject({valid:true,componentCount:1,crossingCount:4})
})
it('rejects nonplanar rotation systems even when every label occurs twice',()=>{
  expect(validatePDCode(pd([[1,2,1,2]]))).toMatchObject({valid:false,issues:[{message:'PD rotation system is not planar'}]})
  expect(validatePDCode(pd([[1,1,2,2],[3,4,3,4]]))).toMatchObject({valid:false})
  const structurallyValid=new Ajv2020({strict:false}).compile(schema)
  expect(structurallyValid(pd([[1,2,1,2]]))).toBe(true)
})
it('rejects inconsistent underpass directions and malformed/unsupported data',()=>{
  expect(validatePDCode(pd([[2,4,1,5],...trefoil.slice(1)]))).toMatchObject({valid:false,issues:[{message:'Inconsistent incoming underpass directions'}]})
  for(const bad of [pd([]),pd([],0),pd([[1,2,3,4]]),pd([[1,1,1,1]]),pd([[0,0,1,1]]),pd([[-1,-1,2,2]]),pd([[1.5,1.5,2,2]]),pd([[1,1,2]]),pd([[NaN,NaN,2,2]]),pd([Array(4)]),{...pd(trefoil),convention:'urn:unknown'},{...pd(trefoil),extra:1},pd([], -1),pd([],1.5)])expect(validatePDCode(bad).valid).toBe(false)
})
it('preserves arbitrary positive edge labels, crossing order and frozen input',()=>{
  const data=pd([...trefoil].reverse().map(c=>c.map(v=>v*100+7)))
  const before=JSON.stringify(data)
  data.crossings.forEach(Object.freeze);Object.freeze(data.crossings);Object.freeze(data)
  expect(validatePDCode(data)).toMatchObject({valid:true,data,componentCount:1})
  expect(JSON.stringify(data)).toBe(before)
})
it('integrates resources, standalone documents, targets, selection and composition',()=>{
  const data=pd(link,1), a=knot(data)
  expect(validateKnot(a,options)).toMatchObject({valid:true,complete:true,uncheckedTypes:[]})
  expect(validateKnot(a)).toMatchObject({valid:true,complete:false,uncheckedTypes:[]})
  expect(validateRepresentationDocument({schema:'RepresentationDocument',schemaVersion:1,representation:a.representations[0]},options)).toMatchObject({valid:true,complete:true})
  expect(validateKnot({...a,namespaces:{r:'https://yuriyapostol.github.io/knot-engine/v1/representation-types/'},representations:[{...a.representations[0],type:'r:pd-code'}]},options)).toMatchObject({valid:true,complete:true})
  const construction={id:'setup',objects:[{id:'rope',type:ROPE_TYPE,topology:'closed',ends:[]}],states:[{id:'tied'}]}
  const targeted={...a,constructions:[construction],representations:[{...a.representations[0],target:{kind:'state',construction:{id:'setup'},id:'tied'}}]}
  expect(validateKnot(targeted,options)).toMatchObject({valid:true,complete:true})
  expect(validateKnot({...targeted,representations:[{...targeted.representations[0],target:{...targeted.representations[0].target,id:'unknown'}}]},options).valid).toBe(false)
  const selected=selectKnot(a,{representations:['pd']},options)
  expect(validateKnot(selected)).toMatchObject({valid:true,complete:true})
  expect(JSON.parse(JSON.stringify(composeKnot([selected,selected]))).representations[0].data).toEqual(data)
  expect(()=>resolveKnot(a,{representationId:'pd'},options)).toThrow(/spatial-curve/)
  for(const change of [{preferredView:{direction:[0,0,1],up:[0,1,0]}},{views:[{id:'p',name:'Plane',space:'plane',camera:{mode:'plane',center:[0,0],height:1,rotation:0}}]}])expect(validateKnot({...a,representations:[{...a.representations[0],...change}]},options).valid).toBe(false)
})
it('enforces per-code and aggregate crossing budgets before analysis',()=>{
  const disconnected=(n:number)=>Array.from({length:n},(_,i)=>[2*i+1,2*i+1,2*i+2,2*i+2])
  expect(validatePDCode(pd(disconnected(16384)))).toMatchObject({valid:true,componentCount:16384})
  expect(validatePDCode(pd(disconnected(16385))).valid).toBe(false)
  const a=knot(pd(disconnected(8193)))
  expect(validateKnot({...a,representations:[a.representations[0],{...a.representations[0],id:'second'}]},options)).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
})
