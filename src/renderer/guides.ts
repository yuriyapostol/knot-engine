import * as THREE from 'three'
import { boundedGuideStep, guideLabel, guideStep, guideTicks, type ResolvedViewerGuides } from '../components/guides'

export interface SpatialGuides { group: THREE.Group; update(camera: THREE.Camera, height: number): void; dispose(): void }
/** Guides are separate from model geometry and never contribute to fit bounds. */
export function buildSpatialGuides(bounds: THREE.Box3, options: ResolvedViewerGuides, theme: 'light' | 'dark'): SpatialGuides {
  const group = new THREE.Group()
  const labels: THREE.Sprite[] = []
  const disposables: { dispose(): void }[] = []
  const extent = Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 1e-8)
  const color = theme === 'dark' ? 0xabb4c4 : 0x657080
  const requestedStep = options.grid.step === 'auto' ? guideStep(extent) : options.grid.step
  // GridHelper uses a vertex buffer: limit divisions even for a tiny requested step.
  const step = boundedGuideStep(requestedStep, extent, 100)
  if (options.grid.visible) for (const plane of options.grid.planes) {
    const axes = plane === 'xy' ? [0, 1] : plane === 'xz' ? [0, 2] : [1, 2]
    const min = bounds.min.toArray(), max = bounds.max.toArray()
    const divisions = Math.min(104, Math.max(2, ...axes.map(i => Math.ceil(max[i]! / step) - Math.floor(min[i]! / step) + 2)))
    const grid = new THREE.GridHelper(divisions * step, divisions, color, color)
    const center = axes.map(i => (Math.floor(min[i]! / step) - 1 + divisions / 2) * step)
    if (plane === 'xy') { grid.rotation.x = Math.PI / 2; grid.position.set(center[0]!, center[1]!, 0) }
    else if (plane === 'yz') { grid.rotation.z = Math.PI / 2; grid.position.set(0, center[0]!, center[1]!) }
    else grid.position.set(center[0]!, 0, center[1]!)
    grid.material.transparent = true; grid.material.opacity = 0.3
    group.add(grid); disposables.push(grid)
  }
  if (options.axes.visible) {
    // AxesHelper provides positive XYZ; add their negative parts and ticks in one buffer.
    const size = Math.max(extent * 0.6, ...bounds.max.toArray())
    const axes = new THREE.AxesHelper(size)
    group.add(axes); disposables.push(axes)
    const vertices: number[] = [], colors: number[] = []
    const palette = [0xc95050, 0x479b62, 0x528ad1]
    function segment(a: number[], b: number[], axis: number) {
      vertices.push(...a, ...b)
      const c = new THREE.Color(palette[axis])
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    function label(text: string, position: number[], axis: number) {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64
      const context = canvas.getContext('2d')
      if (!context) return
      context.font = '32px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'
      context.fillStyle = theme === 'dark' ? '#f2eee8' : '#29231d'; context.fillText(text, 128, 32, 250)
      const texture = new THREE.CanvasTexture(canvas)
      const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false })
      const sprite = new THREE.Sprite(material)
      sprite.position.fromArray(position); sprite.position.setComponent((axis + 1) % 3, extent * 0.045)
      sprite.scale.set(extent * 0.16, extent * 0.04, 1)
      group.add(sprite); labels.push(sprite); disposables.push(texture, material)
    }
    for (let axis = 0; axis < 3; axis++) {
      const low = Math.min(0, bounds.min.getComponent(axis) - extent * 0.1)
      const a = [0, 0, 0], b = [0, 0, 0]; a[axis] = low
      segment(a, b, axis)
      if (options.axes.ticks || options.axes.labels) for (const value of guideTicks(low, size, guideStep(extent), 24)) {
        const point = [0, 0, 0]; point[axis] = value
        if (options.axes.ticks) {
          const start = [...point], end = [...point]
          start[(axis + 1) % 3] = -extent * 0.012; end[(axis + 1) % 3] = extent * 0.012
          segment(start, end, axis)
        }
        if (options.axes.labels && value !== 0 && Math.abs(value - size) > extent * 0.04) label(guideLabel(value), point, axis)
      }
      if (options.axes.labels) { const point = [0, 0, 0]; point[axis] = size; label(['X', 'Y', 'Z'][axis]!, point, axis) }
    }
    if (options.axes.labels) label('0', [0, 0, 0], 0)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const material = new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false })
    group.add(new THREE.LineSegments(geometry, material)); disposables.push(geometry, material)
  }
  return { group, update(camera, height) {
    camera.updateMatrixWorld()
    const point = new THREE.Vector3()
    for (const sprite of labels) {
      let visibleHeight: number
      if (camera instanceof THREE.PerspectiveCamera) {
        const depth = -point.copy(sprite.position).applyMatrix4(camera.matrixWorldInverse).z
        visibleHeight = 2 * Math.max(depth, camera.near) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom
      } else if (camera instanceof THREE.OrthographicCamera) visibleHeight = (camera.top - camera.bottom) / camera.zoom
      else continue
      const pixel = visibleHeight / Math.max(height, 1)
      sprite.scale.set(104 * pixel, 26 * pixel, 1)
    }
  }, dispose() { for (const resource of disposables) resource.dispose(); group.clear() } }
}
