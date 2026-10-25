import { validateKnot } from '../src/core/validateKnot'
import { selectKnot } from '../src/core/knotParts'
import { composeKnot } from '../src/core/knotParts'
import { resolveKnot } from '../src/core/resolve'
import { expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020.js'
import schema from '../v1/schema/dt-code.schema.json'
import { DT_CODE, DT_SIGNED_EVEN as convention, validateDTCode, validateRepresentationDocument, STANDARD_RESOURCES } from '../src/core'
const dt=(code:number[] | number[][])=>({convention,code})
const knot=(code:number[] | number[][])=>({schema:'Knot',schemaVersion:1,id:'dt',subject:{id:'s'},representations:[{id:'dt',type:DT_CODE,data:dt(code)}]})
const options={registries:[STANDARD_RESOURCES]}
it('validates sourced DT examples, both signs, reducible diagrams and the empty unknot',()=>{
  for (const code of [[],[2],[2,4],[4,6,2],[4,6,8,2],[4,6,2,10,12,8],[6,10,14,12,16,2,18,4,8],[4,8,10,-14,2,-16,-18,-6,-12],[16,18,20,-22,4,2,8,-6,12,10,-14]]) {
    expect(validateDTCode(dt(code)),String(code)).toMatchObject({valid:true,componentCount:1,crossingCount:code.length})
    expect(validateDTCode(dt(code.map(n=>-n)))).toMatchObject({valid:true,crossingCount:code.length})
  }
})
it('rejects malformed numbers, permutations, conventions and mixed component encodings',()=>{
  for (const code of [[0],[-0],[1],[2.5],[Infinity],[NaN],[2,2],[2,-2],[4],[2,6],[2,4,8],Array(2),[2,[4]],[[2],4],[[[2]]]])expect(validateDTCode(dt(code as number[])).valid).toBe(false)
  expect(validateDTCode(dt([4,6,8,10,2]))).toMatchObject({valid:false,issues:[{message:'DT traversal is not planar-realizable'}]})
  expect(validateDTCode({...dt([2]),convention:'dt:signed-even'}).valid).toBe(false)
  expect(validateDTCode({...dt([2]),componentLengths:[2]}).valid).toBe(false)
})
// Independent small-case oracle: enumerate local rotations of the 4-valent
// crossing graph and count faces. It does not use interlacement matrices.
function bruteRealizable(input:number[] | number[][]): boolean {
  const parts:number[][]=input.length && Array.isArray(input[0])?input as number[][]:[input as number[]]
  const code=parts.flat(),n=code.length,m=2*n
  const previous:number[]=[]
  let offset=0
  for(const part of parts) { const size=2*part.length; for(let i=0;i<size;i++)previous.push(offset+(i+size-1)%size); offset+=size }
  const graph=Array.from({length:n},(_,i)=>i),visit:number[]=[]
  code.forEach((e,i)=>{visit[2*i]=i;visit[Math.abs(e)-1]=i})
  const root=(i:number):number=>{while(graph[i]!==i)i=graph[i];return i}
  for(let p=0;p<m;p++)graph[root(visit[p])]=root(visit[previous[p]])
  const connected=new Set(graph.map((_,i)=>root(i))).size
  if(!n)return true
  for(let mask=0;mask<2**n;mask++) {
    const ends:number[][]=Array.from({length:m},()=>[])
    code.forEach((e,i)=>{
      const p=2*i,q=Math.abs(e)-1,pi=previous[p],qi=previous[q]
      const labels=mask&(1<<i)?[pi,q,p,qi]:[pi,qi,p,q]
      labels.forEach((label,slot)=>ends[label].push(4*i+slot))
    })
    const alpha=new Int32Array(4*n)
    for(const [a,b] of ends){alpha[a]=b;alpha[b]=a}
    const seen=new Uint8Array(4*n);let faces=0
    for(let h=0;h<4*n;h++)if(!seen[h]) {
      faces++;let current=h
      do {seen[current]=1;const other=alpha[current];current=(other&~3)+((other+1)%4)}while(current!==h)
    }
    if(faces-n===2*connected)return true
  }
  return false
}
function permutations(a:number[]):number[][] {return a.length?a.flatMap((v,i)=>permutations(a.filter((_,j)=>j!==i)).map(p=>[v,...p])):[[]]}
it('agrees with independently enumerated planar rotations for all even permutations through six crossings',()=>{
  let invalid=0
  const structure=new Ajv2020({strict:false}).compile(schema)
  for(let n=0;n<=6;n++) for(const code of permutations(Array.from({length:n},(_,i)=>2*i+2))) {
    const expected=bruteRealizable(code),actual=validateDTCode(dt(code))
    expect(actual.valid,String(code)).toBe(expected)
    if(!expected){invalid++;expect(structure(dt(code))).toBe(true)}
  }
  expect(invalid).toBeGreaterThan(0)
})
it('supports metadata, standalone documents, scopes and preserves code order/signs without claiming renderer support',()=>{
  const a={...knot([4,6,2]),sources:[{id:'atlas',title:'Knot Atlas'}],license:{name:'Example terms'}}
  const rep={...a.representations[0],sources:[{id:'atlas',locator:'DT example',note:'Signs retained'}],contributions:[{name:'Editor',roles:['validation']}]}
  a.representations=[rep]
  expect(validateKnot(a,options)).toMatchObject({valid:true,complete:true,uncheckedTypes:[]})
  expect(validateKnot(a)).toMatchObject({valid:true,complete:false})
  expect(validateRepresentationDocument({schema:'RepresentationDocument',schemaVersion:1,sources:a.sources,representation:rep},options)).toMatchObject({valid:true,complete:true})
  expect(validateKnot({...a,namespaces:{r:'https://yuriyapostol.github.io/knot-engine/v1/representation-types/'},representations:[{...rep,type:'r:dt-code'}]},options)).toMatchObject({valid:true,complete:true})
  expect(validateKnot({...a,representations:[{...rep,target:{kind:'construction',construction:{id:'missing'}}}]},options).valid).toBe(false)
  const selected=selectKnot(a,{representations:['dt']},options)
  expect(JSON.parse(JSON.stringify(composeKnot([selected,selected]))).representations[0]).toEqual(rep)
  expect(()=>resolveKnot(a,{representationId:'dt'},options)).toThrow(/spatial-curve/)
  for(const change of [{preferredView:{direction:[0,0,1],up:[0,1,0]}},{views:[{id:'p',name:'Plane',space:'plane',camera:{mode:'plane',center:[0,0],height:1,rotation:0}}]}])expect(validateKnot({...a,representations:[{...rep,...change}]},options).valid).toBe(false)
  const frozen=dt([4,-6,2]);Object.freeze(frozen.code);Object.freeze(frozen)
  expect(validateDTCode(frozen)).toMatchObject({valid:true,data:frozen})
})
it('bounds matrix work before analysis including compact type references',()=>{
  const max=Array.from({length:512},(_,i)=>2*i+2)
  expect(validateDTCode(dt(max))).toMatchObject({valid:true,crossingCount:512})
  expect(validateDTCode(dt([...max,1026])).valid).toBe(false)
  const a=knot(max)
  expect(validateKnot({...a,namespaces:{r:'https://yuriyapostol.github.io/knot-engine/v1/representation-types/'},representations:[{...a.representations[0],type:'r:dt-code'},{...a.representations[0],id:'other'}]},options)).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
})
it('checks nontrivial interlacement across packed 32-bit row boundaries',()=>{
  // Odd two-strand torus shadows have the complete interlacement graph K_n.
  for(const n of [31,33,65]) {
    const code=Array.from({length:n},(_,i)=>(2*i+n)%(2*n)+1)
    expect(validateDTCode(dt(code))).toMatchObject({valid:true,crossingCount:n})
  }
  const loops=Array.from({length:33},(_,i)=>2*i+2)
  expect(validateDTCode(dt([...loops,...[4,6,8,10,2].map(e=>e+66)]))).toMatchObject({valid:false,issues:[{message:'DT traversal is not planar-realizable'}]})
})

it('validates links, split subdiagrams and explicit crossing-free components',()=>{
  for(const code of [[[4],[2]],[[6,-8],[-10,12,-14,2,-4]],[[2],[4]],[[],[4],[2],[]],[[],[]],[[]]]) {
    expect(validateDTCode(dt(code)),JSON.stringify(code)).toMatchObject({valid:true,componentCount:code.length,crossingCount:code.flat().length})
    expect(validateKnot(knot(code),options)).toMatchObject({valid:true,complete:true,uncheckedTypes:[]})
  }
  expect(validateDTCode(dt([[4],[2]]))).toMatchObject({valid:true,componentCount:2,crossingCount:2})
  // Concatenation describes one different component even when both codes are planar.
  expect(validateDTCode(dt([4,2]))).toMatchObject({valid:true,componentCount:1,crossingCount:2})
  const frozen=dt([Object.freeze([4]),Object.freeze([2])] as unknown as number[][])
  Object.freeze(frozen.code);Object.freeze(frozen)
  expect(validateDTCode(frozen)).toMatchObject({valid:true,data:frozen})
  const a=knot([[],[4],[2]])
  const selected=selectKnot(a,{representations:['dt']},options)
  expect(composeKnot([selected,selected]).representations?.[0].data).toEqual(a.representations[0].data)
  expect(validateRepresentationDocument({schema:'RepresentationDocument',schemaVersion:1,representation:a.representations[0]},options)).toMatchObject({valid:true,complete:true})
})
it('agrees with an independent rotation oracle for every component partition through five crossings',()=>{
  let count=0,invalid=0
  for(let n=1;n<=5;n++)for(const code of permutations(Array.from({length:n},(_,i)=>2*i+2)))for(let cuts=0;cuts<2**(n-1);cuts++) {
    const parts:number[][]=[[]]
    code.forEach((e,i)=>{parts[parts.length-1].push(e);if(i<n-1 && cuts&(1<<i))parts.push([])})
    const expected=bruteRealizable(parts)
    expect(validateDTCode(dt(parts)).valid,JSON.stringify(parts)).toBe(expected)
    if(!expected)invalid++
    count++
  }
  expect(count).toBe(2141)
  expect(invalid).toBeGreaterThan(0)
})
it('bounds total link crossings, components and reduced-word work',()=>{
  expect(validateDTCode(dt(Array.from({length:512},()=>[])))).toMatchObject({valid:true,componentCount:512,crossingCount:0})
  expect(validateDTCode(dt(Array.from({length:513},()=>[]))).valid).toBe(false)
  const loops=Array.from({length:512},(_,i)=>[2*i+2])
  expect(validateDTCode(dt(loops))).toMatchObject({valid:true,componentCount:512,crossingCount:512})
  expect(validateDTCode(dt([...loops,[1026]])).valid).toBe(false)
  // 256 Hopf crossings against a central component: one reduced word with
  // 512+256 letters, exceeding the work cap although the stored code fits.
  const star:number[][]=[[]]
  for(let i=0;i<256;i++){star[0].push(514+2*i);star.push([2+2*i])}
  expect(validateDTCode(dt(star))).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
  expect(validateKnot(knot(star),options)).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
  expect(validateKnot({...knot(star),namespaces:{r:'https://yuriyapostol.github.io/knot-engine/v1/representation-types/'},representations:[{...knot(star).representations[0],type:'r:dt-code'}]},options)).toMatchObject({valid:false,issues:[{code:'LIMIT_EXCEEDED'}]})
})
