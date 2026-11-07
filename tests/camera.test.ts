import { resolveKnot } from '../src/core/resolve'
import { expect, it } from 'vitest'
import * as THREE from 'three'
import { prepareCamera, cameraView, fitView } from '../src/renderer/camera'
import { type Camera3D, type RawKnot } from '../src/core'
import open from '../v1/examples/knots/open-rope.json'
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
it('uses only explicitly supplied application views, never knot view presets',()=>{
  const a=structuredClone(open) as unknown as RawKnot
  expect(resolveKnot(a).camera).toBeUndefined()
  expect(resolveKnot(a,{view:{id:'app',name:'App',space:'space',camera:{mode:'fit',direction:[0,1,0],up:[0,0,1],projection:{kind:'perspective',fovY:1}}}}).camera).toMatchObject({direction:[0,1,0]})
})

it('fits the current orientation and projection while recentering and replacing the previous zoom', () => {
  for (const aspect of [0.25, 1, 4]) for (const projection of [
    { kind: 'perspective' as const, fovY: 1.1 },
    { kind: 'orthographic' as const, height: 0.1 },
  ]) {
    const { camera, target } = prepareCamera({ mode: 'fixed', position: [12, -7, 10], target: [4, 2, -1], up: [0, 0, 1], projection }, bounds, aspect)
    if (camera instanceof THREE.OrthographicCamera) camera.zoom = 3
    const orientation = camera.quaternion.clone()
    const movedBounds = bounds.clone().translate(new THREE.Vector3(10, -5, 2))
    const fitted = prepareCamera(fitView(camera, target), movedBounds, aspect)
    expect(fitted.target.equals(movedBounds.getCenter(new THREE.Vector3()))).toBe(true)
    expect(fitted.camera.quaternion.angleTo(orientation)).toBeLessThan(1e-7)
    expect(fitted.camera.up.equals(camera.up)).toBe(true)
    expect(fitted.camera.type).toBe(camera.type)
    if (fitted.camera instanceof THREE.PerspectiveCamera) expect(fitted.camera.fov).toBeCloseTo(THREE.MathUtils.radToDeg(1.1))
    fitted.camera.updateMatrixWorld()
    for (const x of [movedBounds.min.x, movedBounds.max.x]) for (const y of [movedBounds.min.y, movedBounds.max.y]) for (const z of [movedBounds.min.z, movedBounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(fitted.camera)
      expect(Math.abs(point.x)).toBeLessThan(1)
      expect(Math.abs(point.y)).toBeLessThan(1)
      expect(Math.abs(point.z)).toBeLessThan(1)
    }
  }
})
