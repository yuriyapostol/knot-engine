import * as THREE from 'three'
import type { Camera3D, CameraView } from '../core'
export type RenderCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera
export const DEFAULT_CAMERA: Camera3D = {mode:'fit',direction:[0.38,0.25,1],up:[0,1,0],projection:{kind:'perspective',fovY:55*Math.PI/180}}
/** Pure camera preparation shared by the viewport and PNG capture. */
export function prepareCamera(view: Camera3D, bounds: THREE.Box3, aspect: number): { camera: RenderCamera; target: THREE.Vector3 } {
  const sphere=bounds.getBoundingSphere(new THREE.Sphere()), radius=Math.max(sphere.radius,1e-8)
  const target=view.mode === 'fixed' ? new THREE.Vector3(...view.target) : bounds.getCenter(new THREE.Vector3())
  const direction=view.mode === 'fit' ? new THREE.Vector3(...view.direction).normalize() : new THREE.Vector3(...view.position).sub(target).normalize()
  const padding=view.mode === 'fit' ? view.padding ?? 1.1 : 1
  let camera: RenderCamera, distance: number
  if(view.projection.kind === 'perspective') {
    camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(view.projection.fovY),aspect)
    distance=radius*padding/Math.sin(Math.atan(Math.tan(view.projection.fovY/2)*Math.min(aspect,1)))
  } else {
    const height=view.mode === 'fixed' && view.projection.kind === 'orthographic' ? view.projection.height : 2*radius*padding/Math.min(aspect,1)
    camera=new THREE.OrthographicCamera(-height*aspect/2,height*aspect/2,height/2,-height/2)
    distance=radius*3
  }
  camera.position.copy(view.mode === 'fixed' ? new THREE.Vector3(...view.position) : target.clone().addScaledVector(direction,distance))
  camera.up.set(...view.up).normalize()
  distance=camera.position.distanceTo(sphere.center)
  camera.near=Math.max(radius/10000,1e-10)
  camera.far=Math.max(distance+radius*8,camera.near*100)
  camera.lookAt(target)
  camera.updateProjectionMatrix()
  return {camera,target}
}
export function cameraView(camera: RenderCamera, target: THREE.Vector3): CameraView {
  return {mode:'fixed',position:camera.position.toArray(),target:target.toArray(),up:camera.up.toArray(),projection:camera instanceof THREE.PerspectiveCamera ? {kind:'perspective',fovY:THREE.MathUtils.degToRad(camera.fov)} : {kind:'orthographic',height:(camera.top-camera.bottom)/camera.zoom}}
}
export function resizeCamera(camera: RenderCamera, aspect: number) {
  if(camera instanceof THREE.PerspectiveCamera) camera.aspect=aspect
  else { const height=camera.top-camera.bottom; camera.left=-height*aspect/2;camera.right=height*aspect/2 }
  camera.updateProjectionMatrix()
}
