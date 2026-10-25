import { expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { KnotViewer, resolveKnot, type RawKnot } from '../src'
import { buildGeometry } from '../src/geometry/build'
import open from '../v1/examples/knots/open-rope.json'
it('builds finite geometry for all supported interpolation modes',()=>{
  for(const interpolation of [{type:'polyline' as const},{type:'catmull-rom' as const,parameterization:'uniform' as const,tension:0.5},{type:'catmull-rom' as const,parameterization:'centripetal' as const},{type:'catmull-rom' as const,parameterization:'chordal' as const}]) {
    const model=resolveKnot(open);model.curves[0].interpolation=interpolation
    const built=buildGeometry(model,'medium','light')
    expect(built.bounds.isEmpty()).toBe(false)
    for(const mesh of built.group.children)if('geometry' in mesh)expect(Array.from((mesh.geometry as import('three').BufferGeometry).attributes.position.array).every(Number.isFinite)).toBe(true)
    built.dispose()
  }
})
it('server renders without WebGL or DOM access',async()=>{
  const html=await renderToString(createSSRApp(KnotViewer,{knot:open as unknown as RawKnot,label:'Rope'}))
  expect(html).toContain('Rope');expect(html).not.toContain('<canvas')
})
