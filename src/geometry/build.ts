import * as THREE from 'three'
import { ViewerError, type RenderableModel } from '../core'

export type Quality = 'low' | 'medium' | 'high'
const profiles = { low: [64, 8], medium: [128, 12], high: [256, 16] } as const

export interface BuiltModel { group: THREE.Group; bounds: THREE.Box3; warnings: string[]; dispose(): void }

export function buildGeometry(model: RenderableModel, quality: Quality, theme: 'light' | 'dark'): BuiltModel {
  const warnings: string[] = [...model.warnings]
  let profile: Quality = quality
  const triangles = (p: Quality) => model.curves.length * (profiles[p][0] * profiles[p][1] * 4 + profiles[p][1] * 4)
  while (triangles(profile) > 100000 && profile !== 'low') {
    profile = profile === 'high' ? 'medium' : 'low'
    warnings.push(`Geometry quality reduced to ${profile} to stay within the triangle budget`)
  }
  if (triangles(profile) > 100000) throw new ViewerError('LIMIT_EXCEEDED', 'Geometry exceeds triangle budget', undefined, false)
  const group = new THREE.Group()
  const resources: Array<THREE.BufferGeometry | THREE.Material> = []
  const [tubular, radial] = profiles[profile]
  for (const data of model.curves) {
    const points = data.points.map(p => new THREE.Vector3(...p))
    const path = new THREE.CatmullRomCurve3(points, data.closed, 'catmullrom', data.interpolation.tension)
    const rope = new THREE.MeshStandardMaterial({ color: theme === 'dark' ? 0xe8ad73 : 0xb9793d, roughness: 0.83, metalness: 0 })
    const outline = new THREE.MeshBasicMaterial({ color: theme === 'dark' ? 0x140f17 : 0x33251e, side: THREE.BackSide })
    const geo = new THREE.TubeGeometry(path, tubular, data.radius, radial, data.closed)
    const outlineGeo = new THREE.TubeGeometry(path, tubular, data.radius * 1.065, radial, data.closed)
    resources.push(rope, outline, geo, outlineGeo)
    group.add(new THREE.Mesh(geo, rope), new THREE.Mesh(outlineGeo, outline))
    if (!data.closed) for (const end of [0, 1]) {
      const center = path.getPoint(end)
      const direction = path.getTangent(end).multiplyScalar(end === 0 ? -1 : 1)
      const capGeo = new THREE.CircleGeometry(data.radius, radial)
      capGeo.rotateX(0)
      const cap = new THREE.Mesh(capGeo, rope)
      cap.position.copy(center)
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize())
      group.add(cap)
      resources.push(capGeo)
    }
  }
  const bounds = new THREE.Box3().setFromObject(group)
  return { group, bounds, warnings, dispose() { for (const resource of resources) resource.dispose() } }
}
