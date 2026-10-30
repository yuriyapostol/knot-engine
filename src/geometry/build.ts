import type { RenderableModel } from '../core/resolve'
import * as THREE from 'three'
import { ViewerError } from '../core'

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
    let path: THREE.Curve<THREE.Vector3>
    if (data.interpolation.type === 'polyline') {
      const lines = new THREE.CurvePath<THREE.Vector3>()
      for (let i = 1; i < points.length; i++) lines.add(new THREE.LineCurve3(points[i-1], points[i]))
      if (data.closed) lines.add(new THREE.LineCurve3(points[points.length-1], points[0]))
      path = lines
    } else path = new THREE.CatmullRomCurve3(points, data.closed, data.interpolation.parameterization === 'uniform' ? 'catmullrom' : data.interpolation.parameterization, data.interpolation.parameterization === 'uniform' ? data.interpolation.tension : undefined)
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
  for (const mesh of model.meshes ?? []) {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(mesh.faces.length * 9)
    mesh.faces.forEach((face, i) => face.forEach((index, j) => {
      const point = mesh.vertices[index]
      positions.set(point, i * 9 + j * 3)
    }))
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({ color: theme === 'dark' ? 0xe8ad73 : 0xb9793d, side: THREE.DoubleSide, roughness: 0.83 })
    group.add(new THREE.Mesh(geometry, material))
    resources.push(geometry, material)
  }
  const bounds = new THREE.Box3().setFromObject(group)
  return { group, bounds, warnings, dispose() { for (const resource of resources) resource.dispose() } }
}
