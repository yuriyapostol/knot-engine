import { expect, it } from 'vitest'
import * as THREE from 'three'
import { prepareCamera, cameraView } from '../src/renderer/camera'
import { resolveKnotAsset, type Camera3D, type KnotAsset } from '../src/core'
import open from '../v1/examples/assets/open-rope.json'
const bounds=new THREE.Box3(new THREE.Vector3(-2,-1,-3),new THREE.Vector3(2,1,3))
it('fits the entire bounding box for both projections in wide and narrow viewports',()=>{
  for(const aspect of [0.25,1,4])for(const projection of [{kind:'orthographic' as const},{kind:'perspective' as const,fovY:Math.PI/3}]) {
    const {camera}=prepareCamera({mode:'fit',direction:[1,2,3],up:[0,1,0],projection},bounds,aspect)
    camera.updateMatrixWorld()
    for(const x of [-2,2])for(const y of [-1,1])for(const z of [-3,3]) {
      const p=new THREE.Vector3(x,y,z).project(camera)
      expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);expect(Math.abs(p.z)).toBeLessThan(1)
    }
  }
})
it('preserves fixed framing and radians through camera events',()=>{
  const view:Camera3D={mode:'fixed',position:[12,0,0],target:[0,0,0],up:[0,0,1],projection:{kind:'orthographic',height:5}}
  const {camera,target}=prepareCamera(view,bounds,2)
  expect(cameraView(camera,target)).toEqual(view)
})
it('uses only explicitly supplied application views, never asset view presets',()=>{
  const a=structuredClone(open) as unknown as KnotAsset
  expect(resolveKnotAsset(a).camera).toBeUndefined()
  expect(resolveKnotAsset(a,{view:{id:'app',name:'App',space:'space',camera:{mode:'fit',direction:[0,1,0],up:[0,0,1],projection:{kind:'perspective',fovY:1}}}}).camera).toMatchObject({direction:[0,1,0]})
})
