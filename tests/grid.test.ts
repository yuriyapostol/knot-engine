import { expect, it } from 'vitest'
import { validateGridDiagram, validateAsset, validateRepresentationDocument, STANDARD_RESOURCES, GRID_DIAGRAM, selectAsset, composeAsset } from '../src/core'
const grid=(x:number[],o:number[])=>({encoding:'xo',size:x.length,x,o})
it('counts closed components and strict interior crossings',()=>{
  expect(validateGridDiagram(grid([0,1],[1,0]))).toMatchObject({valid:true,componentCount:1,crossingCount:0})
  expect(validateGridDiagram(grid([0,1,2,3],[1,0,3,2]))).toMatchObject({valid:true,componentCount:2,crossingCount:0})
  expect(validateGridDiagram(grid([0,1,2,3],[2,3,0,1]))).toMatchObject({valid:true,componentCount:2,crossingCount:2})
  const result=validateGridDiagram(grid([0,1,2,3,4],[2,3,4,0,1]))
  expect(result).toMatchObject({valid:true,componentCount:1,crossingCount:3})
  expect(validateGridDiagram(grid([2,3,4,0,1],[0,1,2,3,4]))).toMatchObject({valid:true,componentCount:1,crossingCount:3})
})
it('accepts KnotInfo 6_2 geometry with an explicitly chosen orientation',()=>{
  // https://linkinfo.knotinfo.org/descriptions/grid_notation.html
  const points=[[1,1],[1,3],[2,2],[2,4],[3,3],[3,5],[4,4],[4,7],[5,6],[5,8],[6,1],[6,7],[7,5],[7,8],[8,2],[8,6]]
  const d=grid([2,3,4,6,5,0,7,1],[0,1,2,3,7,6,4,5])
  expect(validateGridDiagram(d)).toMatchObject({valid:true,componentCount:1})
  const restored=d.x.flatMap((r,c)=>[[c+1,r+1],[c+1,d.o[c]+1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])
  expect(restored).toEqual(points)
})
it('rejects malformed values and enforces size boundaries',()=>{
  const good=grid([0,1],[1,0])
  for(const change of [{size:1},{size:513},{x:[0,0]},{x:[0,2]},{x:[-1,1]},{x:[0.5,1]},{x:[NaN,1]},{x:[Infinity,1]},{x:[0]},{x:Array(2)},{o:[0,1]},{extra:1},{encoding:'vertex-pairs'}]) expect(validateGridDiagram({...good,...change}).valid).toBe(false)
  const x=Array.from({length:512},(_,i)=>i),o=x.map(i=>(i+1)%512)
  expect(validateGridDiagram(grid(x,o))).toMatchObject({valid:true,componentCount:1})
})
it('preserves viewer-independent representations and complete standalone and composed assets',()=>{
  const rep={id:'g',type:GRID_DIAGRAM,data:grid([0,1],[1,0])}
  const asset={schema:'Asset',schemaVersion:1,id:'g',subject:{id:'s'},representations:[rep]}
  const options={registries:[STANDARD_RESOURCES]}
  expect(validateAsset(asset,options)).toMatchObject({valid:true,complete:true,uncheckedTypes:[]})
  expect(validateAsset(asset)).toMatchObject({valid:true,complete:false})
  expect(validateRepresentationDocument({schema:'KnotRepresentationDocument',schemaVersion:1,representation:rep},options)).toMatchObject({valid:true,complete:true})
  expect(validateAsset({...asset,representations:[{...rep,preferredView:{direction:[0,0,1],up:[0,1,0]}}]},options).valid).toBe(false)
  const part=selectAsset(asset,{representations:['g']},options)
  expect(validateAsset(part)).toMatchObject({valid:true,complete:true})
  expect(JSON.parse(JSON.stringify(composeAsset([part,part]))).representations[0].data).toEqual(rep.data)
})
it('preserves different grid encodings as separate representations of one subject',()=>{
  const representations=[
    {id:'xo',type:GRID_DIAGRAM,data:grid([0,1],[1,0])},
    {id:'pairs',type:GRID_DIAGRAM,data:{encoding:'vertex-pairs',size:2,vertices:[[1,1],[0,0],[1,0],[0,1]]}},
  ]
  const asset={schema:'Asset',schemaVersion:1,id:'mixed-grid',subject:{id:'s'},representations}
  const options={registries:[STANDARD_RESOURCES]}
  expect(validateAsset(asset,options)).toMatchObject({valid:true,complete:true,uncheckedTypes:[]})
  const selected=selectAsset(asset,{representations:['xo','pairs']},options)
  expect(selected.representations).toEqual(representations)
  const parts=representations.map(rep=>selectAsset(asset,{representations:[rep.id]},options))
  const composed=composeAsset(parts)
  expect(composed.representations).toEqual(representations)
  expect(validateAsset(composed)).toMatchObject({valid:true,complete:true})
  expect(validateAsset({...asset,representations:representations.map(rep=>({...rep,id:'same'}))},options).valid).toBe(false)
})
it('validates zero-based unoriented vertex pairs and preserves input order',()=>{
  const vertices:[[number,number],[number,number],[number,number],[number,number]]=[[1,1],[0,0],[1,0],[0,1]]
  const d={encoding:'vertex-pairs',size:2,vertices}
  expect(validateGridDiagram(d)).toMatchObject({valid:true,componentCount:1,crossingCount:0,data:d})
  const asset={schema:'Asset',schemaVersion:1,id:'v',subject:{id:'s'},representations:[{id:'v',type:GRID_DIAGRAM,data:d}]}
  const options={registries:[STANDARD_RESOURCES]}
  expect(validateAsset(asset,options)).toMatchObject({valid:true,complete:true})
  const part=selectAsset(asset,{representations:['v']},options)
  expect(composeAsset([part,part]).representations![0].data).toEqual(d)
  for(const change of [{vertices:[[0,0],[0,0],[1,0],[1,1]]},{vertices:[[0,0],[0,1],[1,0]]},{vertices:[[0,0],[0,1],[1,0],[2,1]]},{vertices:[[0,0],[0,1],[1,0],[1,-1]]},{vertices:[[0,0],[0,1],[1,0],[1,0.5]]},{vertices:[[0,0],[0,1],[1,0],[1,1,2]]},{x:[0,1]},{size:3}])expect(validateGridDiagram({...d,...change}).valid).toBe(false)
  const pairs=(x:number[],o:number[])=>({encoding:'vertex-pairs',size:x.length,vertices:x.flatMap((r,c)=>[[c,r],[c,o[c]]])})
  for(const [x,o] of [[[0,1,2,3],[1,0,3,2]],[[0,1,2,3],[2,3,0,1]],[[0,1,2,3,4],[2,3,4,0,1]]]) {
    const xo=validateGridDiagram(grid(x,o)), vp=validateGridDiagram(pairs(x,o))
    expect(xo.valid && vp.valid && [vp.componentCount,vp.crossingCount]).toEqual(xo.valid && [xo.componentCount,xo.crossingCount])
    expect(validateGridDiagram({...pairs(x,o),vertices:pairs(x,o).vertices.reverse()})).toMatchObject({valid:true,...(xo.valid?{componentCount:xo.componentCount,crossingCount:xo.crossingCount}:{})})
  }
  const n=512,x=Array.from({length:n},(_,i)=>i)
  expect(validateGridDiagram(pairs(x,x.map(i=>(i+1)%n)))).toMatchObject({valid:true,componentCount:1})
})
it('checks vertex distribution, JSON structure and standalone documents',()=>{
  const d={encoding:'vertex-pairs',size:3,vertices:[[0,0],[0,1],[1,1],[1,2],[2,2],[2,0]]}
  const rep={id:'v',type:GRID_DIAGRAM,data:d}
  expect(validateRepresentationDocument({schema:'KnotRepresentationDocument',schemaVersion:1,representation:rep},{registries:[STANDARD_RESOURCES]})).toMatchObject({valid:true,complete:true})
  for(const vertices of [[[0,0],[0,1],[0,2],[1,0],[1,1],[2,2]],[[0,0],[0,1],[1,0],[1,1],[2,0],[2,2]],[[0,0],[0,1],[1,1],[1,2],[2,2],[2,NaN]],Array(6)])expect(validateGridDiagram({...d,vertices}).valid).toBe(false)
  const before=JSON.stringify(d)
  Object.freeze(d.vertices);Object.freeze(d)
  expect(validateGridDiagram(d).valid).toBe(true)
  expect(JSON.stringify(d)).toBe(before)
})
