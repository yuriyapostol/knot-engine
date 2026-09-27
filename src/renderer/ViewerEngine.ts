import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CameraView, KnotModelV1 } from '../core'
import { ViewerError } from '../core'
import { buildGeometry, type BuiltModel, type Quality } from '../geometry/build'

export interface CaptureOptions { width?: number; height?: number; format?: 'image/png'; view?: 'current' | 'model-preview'; transparent?: boolean }

export class ViewerEngine {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, 0.01, 10000)
  private controls: OrbitControls
  private built?: BuiltModel
  private model?: KnotModelV1
  private initial?: CameraView
  private frame = 0
  private alive = true
  private visible = true
  private active = true
  private ready = false
  private operation = 0
  private theme: 'light' | 'dark' = 'light'
  onReady?: (warnings: string[]) => void
  onCameraChange?: (view: CameraView) => void
  onError?: (error: ViewerError) => void

  constructor(private container: HTMLElement) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      throw new ViewerError('WEBGL_UNAVAILABLE', 'WebGL is unavailable')
    }
    this.canvas = this.renderer.domElement
    this.canvas.className = 'knot-viewer__canvas'
    this.canvas.setAttribute('aria-hidden', 'true')
    this.container.appendChild(this.canvas)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.45
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x786352, 2.1))
    const key = new THREE.DirectionalLight(0xffffff, 2.3)
    key.position.set(5, 9, 12)
    this.scene.add(key)
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enablePan = false
    this.controls.enableDamping = false
    this.controls.minDistance = 0.1
    this.controls.addEventListener('change', this.requestRender)
    this.controls.addEventListener('end', this.emitCamera)
    this.canvas.addEventListener('webglcontextlost', this.contextLost)
    this.canvas.addEventListener('webglcontextrestored', this.contextRestored)
  }

  private requestRender = () => {
    if (this.frame || !this.alive || !this.active || !this.visible || document.hidden) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (!this.alive || !this.built || !this.active || !this.visible || document.hidden) return
      const { width, height } = this.container.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      this.renderer.render(this.scene, this.camera)
      if (!this.ready) { this.ready = true; this.onReady?.(this.built.warnings) }
    })
  }
  private emitCamera = () => this.onCameraChange?.(this.view())
  private contextLost = (event: Event) => {
    event.preventDefault()
    this.ready = false
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.onError?.(new ViewerError('CONTEXT_LOST', 'WebGL context was lost'))
  }
  private contextRestored = () => { this.ready = false; this.requestRender() }

  view(): CameraView { return { position: this.camera.position.toArray() as CameraView['position'], target: this.controls.target.toArray() as CameraView['target'], fov: this.camera.fov } }
  setActive(active: boolean) { this.active = active; if (!active) { cancelAnimationFrame(this.frame); this.frame = 0 } else this.requestRender() }
  setVisible(visible: boolean) { this.visible = visible; if (visible) this.requestRender() }
  setInteractive(interactive: boolean) { this.controls.enabled = interactive }
  setTouchActive(active: boolean) { this.canvas.style.touchAction = active ? 'none' : 'auto'; this.controls.touches.ONE = active ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN; this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE }
  setTheme(theme: 'light' | 'dark') {
    if (this.theme === theme) return
    this.theme = theme
    this.built?.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const material = object.material
      if (material instanceof THREE.MeshStandardMaterial) material.color.setHex(theme === 'dark' ? 0xe8ad73 : 0xb9793d)
      if (material instanceof THREE.MeshBasicMaterial) material.color.setHex(theme === 'dark' ? 0x140f17 : 0x33251e)
    })
    this.requestRender()
  }
  private quality: Quality = 'medium'
  setModel(model: KnotModelV1, quality: Quality, initial?: CameraView) {
    this.operation++
    this.ready = false
    this.quality = quality
    this.model = model
    this.initial = initial
    const built = buildGeometry(model, quality, this.theme)
    if (this.built) { this.scene.remove(this.built.group); this.built.dispose() }
    this.built = built
    this.scene.add(built.group)
    this.resetView()
  }
  clear() {
    this.operation++
    this.model = undefined
    this.ready = false
    if (this.built) { this.scene.remove(this.built.group); this.built.dispose(); this.built = undefined }
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect()
    if (width <= 0 || height <= 0) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }
  private applyView(view: CameraView) {
    this.camera.position.set(...view.position)
    this.controls.target.set(...view.target)
    this.camera.fov = view.fov
    this.camera.updateProjectionMatrix()
    this.controls.update()
    this.requestRender()
  }
  fitToView() {
    if (!this.built) return
    const sphere = this.built.bounds.getBoundingSphere(new THREE.Sphere())
    const radius = Math.max(sphere.radius, 0.01)
    const aspect = Math.max(this.camera.aspect, 0.1)
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2)
    const distance = radius * 1.25 / Math.sin(Math.atan(Math.tan(halfFov) * Math.min(aspect, 1)))
    this.camera.near = Math.max(radius / 1000, 0.0001)
    this.camera.far = Math.max(distance + radius * 8, 10)
    this.controls.minDistance = radius * 1.05
    this.controls.maxDistance = Math.max(distance * 8, radius * 4)
    this.applyView({ position: [sphere.center.x + distance * 0.38, sphere.center.y + distance * 0.25, sphere.center.z + distance], target: sphere.center.toArray() as CameraView['target'], fov: this.camera.fov })
  }
  setInitialCamera(initial?: CameraView) { this.initial = initial; this.resetView() }
  resetView() {
    if (!this.built) return
    const p = this.model?.preview
    const view = this.initial ?? (p?.cameraPosition && p.target ? { position: p.cameraPosition, target: p.target, fov: p.fov ?? 55 } : undefined)
    if (!view) { this.camera.fov = 55; this.fitToView(); return }
    const radius = Math.max(this.built.bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.01)
    const distance = new THREE.Vector3(...view.position).distanceTo(new THREE.Vector3(...view.target))
    this.controls.minDistance = radius * 1.05
    this.controls.maxDistance = Math.max(radius * 12, distance * 5)
    this.camera.near = Math.max(radius / 1000, 0.0001)
    this.camera.far = Math.max(distance + radius * 8, 10)
    if (distance < this.controls.minDistance || !this.built.bounds.containsPoint(new THREE.Vector3(...view.target))) { this.fitToView(); return }
    this.applyView(view)
  }
  orbit(dx: number, dy: number) {
    if (!this.built) return
    const offset = this.camera.position.clone().sub(this.controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.theta += dx; spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy, 0.05, Math.PI - 0.05)
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
    this.controls.update(); this.emitCamera()
  }
  zoom(factor: number) {
    if (!this.built) return
    const offset = this.camera.position.clone().sub(this.controls.target)
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance))
    this.camera.position.copy(this.controls.target).add(offset)
    this.controls.update(); this.emitCamera()
  }
  async capture(options: CaptureOptions = {}): Promise<Blob> {
    if (!this.ready || !this.built || !this.alive) throw new ViewerError('CAPTURE_FAILED', 'Viewer is not ready')
    const width = options.width ?? 512, height = options.height ?? 512
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048 || (options.format && options.format !== 'image/png')) throw new ViewerError('CAPTURE_FAILED', 'Invalid capture dimensions or format')
    const operation = this.operation
    const camera = this.camera.clone()
    camera.aspect = width / height
    if (options.view !== 'model-preview' && camera.aspect < this.camera.aspect) {
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * this.camera.aspect / camera.aspect))
    }
    if (options.view === 'model-preview') {
      const p = this.model?.preview
      if (p?.cameraPosition && p.target) { camera.position.set(...p.cameraPosition); camera.lookAt(...p.target); camera.fov = p.fov ?? 55 }
      else {
        const sphere = this.built.bounds.getBoundingSphere(new THREE.Sphere())
        const distance = sphere.radius * 1.25 / Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1)))
        camera.position.copy(sphere.center).add(new THREE.Vector3(distance * 0.38, distance * 0.25, distance)); camera.lookAt(sphere.center)
      }
    }
    camera.updateProjectionMatrix()
    const target = new THREE.WebGLRenderTarget(width, height, { format: THREE.RGBAFormat })
    const pixels = new Uint8Array(width * height * 4)
    const previousTarget = this.renderer.getRenderTarget()
    const previousBackground = this.scene.background
    const previewColors = new Map<THREE.Material, THREE.Color>()
    if (options.view === 'model-preview') this.built.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const material = object.material
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
        if (!previewColors.has(material)) previewColors.set(material, material.color.clone())
        material.color.setHex(material instanceof THREE.MeshStandardMaterial ? 0xb9793d : 0x33251e)
      }
    })
    try {
      this.scene.background = options.transparent ? null : new THREE.Color(options.view === 'model-preview' || this.theme === 'light' ? 0xf8f5ef : 0x171b24)
      this.renderer.setRenderTarget(target)
      this.renderer.render(this.scene, camera)
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
    } catch { throw new ViewerError('CAPTURE_FAILED', 'Unable to capture image') }
    finally { this.renderer.setRenderTarget(previousTarget); this.scene.background = previousBackground; for (const [material, color] of previewColors) if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) material.color.copy(color); target.dispose() }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new ViewerError('CAPTURE_FAILED', 'Canvas 2D is unavailable')
    const image = context.createImageData(width, height)
    for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4)
    context.putImageData(image, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!this.alive || operation !== this.operation || !blob) throw new ViewerError('CAPTURE_FAILED', 'Capture was cancelled')
    return blob
  }
  dispose() {
    this.alive = false
    this.clear()
    this.controls.removeEventListener('change', this.requestRender)
    this.controls.removeEventListener('end', this.emitCamera)
    this.controls.dispose()
    this.canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.contextRestored)
    this.renderer.dispose()
    this.canvas.remove()
  }
}
