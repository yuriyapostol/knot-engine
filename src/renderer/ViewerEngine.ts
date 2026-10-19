import * as THREE from 'three'
import { verticalDrag } from './touchGesture'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CameraView, Camera3D, RenderableModel } from '../core'
import { ViewerError, validateView } from '../core'
import { prepareCamera, cameraView, resizeCamera, DEFAULT_CAMERA, type RenderCamera } from './camera'
import { buildGeometry, type BuiltModel, type Quality } from '../geometry/build'

export interface CaptureOptions { width?: number; height?: number; format?: 'image/png'; view?: 'current' | 'model-preview'; transparent?: boolean }

export class ViewerEngine {
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: RenderCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 10000)
  private controls: OrbitControls
  private touches = new Map<number, { x: number; y: number }>()
  private built?: BuiltModel
  private model?: RenderableModel
  private initial?: Camera3D
  private frame = 0
  private alive = true
  private visible = true
  private active = true
  private reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
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
    this.canvas.className = 'knot-engine-v1-viewer__canvas'
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
    this.controls.minPolarAngle = 0.05
    this.controls.maxPolarAngle = Math.PI - 0.05
    this.canvas.style.touchAction = 'none'
    this.canvas.addEventListener('pointerdown', this.touchStart, true)
    this.canvas.addEventListener('pointermove', this.touchMove, true)
    this.canvas.addEventListener('pointerup', this.touchEnd, true)
    this.canvas.addEventListener('pointercancel', this.touchEnd, true)
    this.canvas.addEventListener('lostpointercapture', this.touchEnd, true)
    this.controls.enableDamping = !this.reducedMotion?.matches
    this.controls.minDistance = 0.1
    this.controls.addEventListener('change', this.requestRender)
    this.controls.addEventListener('end', this.emitCamera)
    this.reducedMotion?.addEventListener('change', this.motionPreferenceChanged)
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
      const moving = this.controls.enableDamping && this.controls.update()
      this.renderer.render(this.scene, this.camera)
      if (!this.ready) { this.ready = true; this.onReady?.(this.built.warnings) }
      if (moving) this.requestRender()
    })
  }
  private motionPreferenceChanged = () => {
    this.controls.enableDamping = !this.reducedMotion?.matches
    this.requestRender()
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

  view(): CameraView { return cameraView(this.camera,this.controls.target) }
  setActive(active: boolean) { this.active = active; if (!active) { cancelAnimationFrame(this.frame); this.frame = 0 } else this.requestRender() }
  setVisible(visible: boolean) { this.visible = visible; if (visible) this.requestRender() }
  setInteractive(interactive: boolean) {
    this.controls.enabled = interactive
    this.canvas.style.touchAction = interactive ? 'none' : 'auto'
    if (!interactive) this.touches.clear()
  }
  private touchStart = (event: PointerEvent) => {
    if (event.pointerType !== 'touch' || !this.controls.enabled) return
    event.stopImmediatePropagation()
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
    this.canvas.setPointerCapture(event.pointerId)
  }
  private touchMove = (event: PointerEvent) => {
    const previous = this.touches.get(event.pointerId)
    if (!previous) return
    event.stopImmediatePropagation()
    const current = { x: event.clientX, y: event.clientY }
    if (this.touches.size === 1) {
      const height = Math.max(this.canvas.clientHeight, 1)
      const speed = 2 * Math.PI * this.controls.rotateSpeed / height
      const phi = this.controls.getPolarAngle()
      const drag = verticalDrag(phi, current.y - previous.y, speed, this.controls.minPolarAngle, this.controls.maxPolarAngle)
      this.orbit(-(current.x - previous.x) * speed, drag.angle - phi)
      if (drag.scroll) this.scrollPage(drag.scroll)
    } else if (this.touches.size === 2) {
      const other = [...this.touches.entries()].find(([id]) => id !== event.pointerId)![1]
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(current.x - other.x, current.y - other.y)
      if (before > 0 && after > 0) this.zoom(before / after)
    }
    this.touches.set(event.pointerId, current)
  }
  private touchEnd = (event: PointerEvent) => {
    if (!this.touches.delete(event.pointerId)) return
    event.stopImmediatePropagation()
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    this.emitCamera()
  }
  private scrollPage(delta: number) {
    for (let parent = this.container.parentElement; parent; parent = parent.parentElement) {
      if (parent === document.scrollingElement) break
      if (!/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue
      const before = parent.scrollTop
      parent.scrollTop += delta
      delta -= parent.scrollTop - before
      if (Math.abs(delta) < 0.01) return
    }
    window.scrollBy({ top: delta, behavior: 'instant' })
  }
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
  setModel(model: RenderableModel, quality: Quality, initial?: Camera3D) {
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
    resizeCamera(this.camera, width / height)
    this.requestRender()
  }
  private applyView(view: Camera3D) {
    if (!this.built) return
    const validation=validateView({id:'application',name:'Application',space:'space',camera:view})
    if(!validation.valid) throw new ViewerError('INVALID_MODEL','Invalid application camera',validation.issues,false)
    const rect=this.container.getBoundingClientRect()
    const prepared=prepareCamera(view,this.built.bounds,rect.height > 0 ? rect.width/rect.height : 1)
    this.camera=prepared.camera
    this.controls.object=this.camera
    this.controls.target.copy(prepared.target)
    const radius=Math.max(this.built.bounds.getBoundingSphere(new THREE.Sphere()).radius,1e-8)
    this.controls.minDistance=radius/100
    this.controls.maxDistance=Math.max(radius*100,this.camera.position.distanceTo(prepared.target)*10)
    this.controls.update()
    this.requestRender()
  }
  fitToView() { this.applyView(DEFAULT_CAMERA) }
  setInitialCamera(initial?: Camera3D) { this.initial=initial; this.resetView() }
  resetView() { this.applyView(this.initial ?? this.model?.camera ?? DEFAULT_CAMERA) }
  orbit(dx: number, dy: number) {
    if (!this.built) return
    const offset = this.camera.position.clone().sub(this.controls.target)
    const toY = new THREE.Quaternion().setFromUnitVectors(this.camera.up.clone().normalize(), new THREE.Vector3(0,1,0))
    const spherical = new THREE.Spherical().setFromVector3(offset.applyQuaternion(toY))
    spherical.theta += dx; spherical.phi = THREE.MathUtils.clamp(spherical.phi + dy, this.controls.minPolarAngle, this.controls.maxPolarAngle)
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical).applyQuaternion(toY.invert()))
    this.controls.update(); this.emitCamera()
  }
  zoom(factor: number) {
    if (!this.built) return
    if(this.camera instanceof THREE.OrthographicCamera) { this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom/factor,0.01,100); this.camera.updateProjectionMatrix(); this.requestRender(); this.emitCamera(); return }
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
    const camera = options.view === 'model-preview'
      ? prepareCamera(this.model?.camera ?? DEFAULT_CAMERA,this.built.bounds,width/height).camera
      : this.camera.clone()
    if (options.view !== 'model-preview') {
      if(camera instanceof THREE.PerspectiveCamera && this.camera instanceof THREE.PerspectiveCamera && width/height < this.camera.aspect) {
        camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*this.camera.aspect/(width/height)))
      }
      resizeCamera(camera,width/height)
    }
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
    this.reducedMotion?.removeEventListener('change', this.motionPreferenceChanged)
    this.touches.clear()
    this.canvas.removeEventListener('pointerdown', this.touchStart, true)
    this.canvas.removeEventListener('pointermove', this.touchMove, true)
    this.canvas.removeEventListener('pointerup', this.touchEnd, true)
    this.canvas.removeEventListener('pointercancel', this.touchEnd, true)
    this.canvas.removeEventListener('lostpointercapture', this.touchEnd, true)
    this.controls.dispose()
    this.canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.contextRestored)
    this.renderer.dispose()
    this.canvas.remove()
  }
}
