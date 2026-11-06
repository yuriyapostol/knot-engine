<script lang="ts">
// Assigned after hydration so separate Vue roots also have distinct SVG resource IDs.
let nextMaskId = 0
</script>
<script setup lang="ts">
import { useGuides, type ViewerGuides, type ResolvedViewerGuides } from './guides'
import GuideControls from './GuideControls.vue'
import PlaneGuides from './PlaneGuides.vue'
import { computed, onMounted, ref, useId, watch } from 'vue'
import { GEOMETRY_2D, selectRepresentation, validateGeometry2D, resolveRepresentationView, type FlattenedGeometry2DData, type Geometry2DData, type RawKnot, type RawResourceRegistry, type Reference, type ViewDefinition } from '../core'
import { locateCrossings } from './geometry2d'
import { crossingStrokes2D, CROSSING_MASK_SCALE } from './crossingStrokes2d'
import { flattenGeometry2D, mapCurve2D } from './curves2d'
import { mosaicPanCenter } from './mosaicViewport'
import { usePlaneGestures } from './usePlaneGestures'
import { messages as defaults, type ViewerMessages } from '../locales'
import type { CaptureOptions } from './captureOptions'

export interface Geometry2DView { center: [number, number]; height: number }

// Display precision in normalized SVG units; geometry calculations stay unrounded.
const SVG_DECIMAL_PLACES = 6
function svgNumber(value: number): string {
  return String(Number(value.toFixed(SVG_DECIMAL_PLACES)))
}

const props = withDefaults(defineProps<{
  guides?: ViewerGuides
  knot?: RawKnot | null
  representationId?: string
  registries?: RawResourceRegistry[]
  view?: Reference | ViewDefinition
  views?: ViewDefinition[]
  label: string
  description?: string
  theme?: 'light' | 'dark'
  locale?: 'en' | 'uk'
  messages?: Partial<ViewerMessages>
  active?: boolean
  interactive?: boolean
  showControls?: boolean
}>(), { theme: 'light', locale: 'en', active: true, interactive: true, showControls: true })
const emit = defineEmits<{
  'update:guides': [value: ResolvedViewerGuides]
  'guides-change': [value: ResolvedViewerGuides]
  ready: [payload: { knotId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
  'view-change': [view: Geometry2DView]
}>()
const { guides, setGuides } = useGuides(() => props.guides, value => { emit('update:guides', value); emit('guides-change', value) })
const text = computed(() => ({ ...defaults[props.locale], ...props.messages }))
const svg = ref<SVGSVGElement | null>(null)
const maskId = ref(`knot-2d-${useId().replace(/[^a-zA-Z0-9_-]/g, '-')}`)
onMounted(() => { maskId.value += `-${nextMaskId++}` })
const camera = ref<Geometry2DView>({ center: [0, 0], height: 1 })
const canInteract = computed(() => props.active && props.interactive)
const selection = computed(() => props.knot ? selectRepresentation(props.knot, { representationId: props.representationId, type: GEOMETRY_2D }, { registries: props.registries }) : null)
const result = computed(() => {
  if (!selection.value?.ok) return { data: null, error: selection.value && !selection.value.ok ? selection.value.issues[0]?.message : null }
  const checked = validateGeometry2D(selection.value.representation.data)
  if (!checked.valid) return { data: null, error: checked.issues[0]?.message }
  try {
    const flattened = flattenGeometry2D(checked.data)
    const positions = locateCrossings(flattened)
    const points = flattened.elements.flatMap(e => e.points)
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const extent = Math.max(maxX - minX, maxY - minY)
    const fit: Geometry2DView = { center: [minX + (maxX - minX) / 2, minY + (maxY - minY) / 2], height: extent * 1.12 }
    // Native SVG dash measurement loses accuracy on tiny physical coordinates.
    // Measure and draw at a stable local scale, then transform to plane units.
    const svgExtent = 1000
    const renderUnit = extent / svgExtent
    if (!Number.isFinite(renderUnit) || renderUnit <= 0) throw new Error('2D extent exceeds SVG rendering precision')
    function project(data: FlattenedGeometry2DData): FlattenedGeometry2DData
    function project(data: Geometry2DData): Geometry2DData
    function project(data: Geometry2DData): Geometry2DData {
      return { ...data, elements: data.elements.map(curve => mapCurve2D(curve, ([x, y]) => [(x - fit.center[0]) / renderUnit, (y - fit.center[1]) / renderUnit])) }
    }
    const gap = svgExtent * 0.018
    const paths = crossingStrokes2D(project(checked.data), project(flattened), positions, gap, svgNumber)
    const transform = `translate(${fit.center[0]} ${-fit.center[1]}) scale(${renderUnit})`
    return { data: { paths, fit, gap, transform, maskExtent: svgExtent * 1.12 }, error: null }
  } catch (e) { return { data: null, error: (e as Error).message } }
})
const resolvedView = computed(() => resolveRepresentationView(props.view, props.views, props.registries, props.knot?.namespaces))
const error = computed(() => {
  if (!props.knot) return null
  if (result.value.error) return result.value.error
  if (!resolvedView.value.ok) return resolvedView.value.message
  if (resolvedView.value.view && resolvedView.value.view.space !== 'plane') return '2D viewer requires a plane view'
  return null
})
const ready = computed(() => !!result.value.data && !error.value)
const initial = computed((): Geometry2DView => {
  const view = resolvedView.value.ok ? resolvedView.value.view : null
  return view?.space === 'plane' ? { center: [...view.camera.center], height: view.camera.height } : result.value.data?.fit ?? { center: [0, 0], height: 1 }
})
function box(view: Geometry2DView) {
  return [view.center[0] - view.height / 2, -view.center[1] - view.height / 2, view.height, view.height].join(' ')
}
const viewBox = computed(() => box(camera.value))
function announceView() { emit('view-change', { center: [...camera.value.center], height: camera.value.height }) }
function applyView() { camera.value = { center: [...initial.value.center], height: initial.value.height }; clearGestures() }
function resetView() { applyView(); announceView() }
function fitToView() {
  if (!result.value.data) return
  camera.value = { ...result.value.data.fit, center: [...result.value.data.fit.center] }; announceView()
}
function zoom(factor: number) {
  const height = camera.value.height * factor
  const fit = result.value.data?.fit.height ?? 1
  camera.value = { ...camera.value, height: Math.max(Math.min(height, Math.max(fit * 4, initial.value.height)), Math.min(fit / 32, initial.value.height)) }
  announceView()
}
function zoomIn() { zoom(1 / 1.25) }
function zoomOut() { zoom(1.25) }
function onWheel(event: WheelEvent) {
  if (!canInteract.value || !ready.value || event.deltaY === 0) return
  event.preventDefault(); zoom(event.deltaY < 0 ? 1 / 1.25 : 1.25)
}
const { dragging, onPointerDown, onPointerMove, onPointerUp, clear: clearGestures } = usePlaneGestures(
  svg, computed(() => canInteract.value && ready.value),
  (dx, dy) => {
    if (!svg.value) return
    const rect = svg.value.getBoundingClientRect()
    camera.value = { ...camera.value, center: mosaicPanCenter(camera.value.center, dx, dy, camera.value.height, rect.width, rect.height) }
    announceView()
  }, zoom,
)
function onKeyDown(event: KeyboardEvent) {
  if (!canInteract.value || !ready.value) return
  const delta = camera.value.height * 0.1
  const offsets: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, delta], ArrowDown: [0, -delta] }
  if (event.key === '+' || event.key === '=') zoomIn()
  else if (event.key === '-') zoomOut()
  else if (event.key === 'Home') resetView()
  else if (offsets[event.key]) {
    const [dx, dy] = offsets[event.key]
    camera.value = { ...camera.value, center: [camera.value.center[0] + dx, camera.value.center[1] + dy] }; announceView()
  } else return
  event.preventDefault()
}
function capture(options: CaptureOptions = {}): Promise<Blob> {
  if (!svg.value || !ready.value) return Promise.reject(new Error('2D viewer is not ready'))
  const width = options.width ?? 1024, height = options.height ?? 1024
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048 ||
      (options.format && options.format !== 'image/svg+xml') || (options.view && options.view !== 'current' && options.view !== 'model-preview'))
    return Promise.reject(new Error('Invalid 2D capture dimensions, format or view'))
  const clone = svg.value.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('xmlns')
  clone.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', box(options.view === 'model-preview' ? initial.value : camera.value))
  clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height))
  clone.removeAttribute('class'); clone.removeAttribute('tabindex'); clone.removeAttribute('style')
  clone.style.color = getComputedStyle(svg.value).color
  if (options.transparent === false) {
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    const [x, y, w, h] = clone.getAttribute('viewBox')!.split(' ')
    for (const [name, value] of Object.entries({ x, y, width: w, height: h, fill: getComputedStyle(svg.value.parentElement!).backgroundColor })) background.setAttribute(name, value!)
    clone.insertBefore(background, clone.firstChild)
  }
  return Promise.resolve(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
}
watch(initial, applyView, { immediate: true })
watch([result, error], () => {
  if (ready.value && props.knot) emit('ready', { knotId: props.knot.id, schemaVersion: 1, warnings: [] })
  else if (error.value) emit('error', { code: 'INVALID_MODEL', message: error.value, recoverable: false })
}, { immediate: true })
defineExpose({ resetView, fitToView, capture })
</script>
<template>
  <div class="knot-engine-v1-viewer" :data-theme="theme" :data-state="ready ? 'ready' : error ? 'error' : 'empty'" :aria-label="label" :aria-description="description" role="group">
    <svg v-if="ready && result.data" ref="svg" class="knot-engine-v1-geometry2d" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="label" :tabindex="canInteract ? 0 : undefined" :style="{ touchAction: canInteract ? 'none' : 'auto' }" @wheel="onWheel" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @lostpointercapture="onPointerUp" @keydown="onKeyDown">
      <PlaneGuides v-if="guides.grid.visible || guides.axes.visible" :guides="guides" :box="viewBox" mode="geometry" />
      <defs>
        <path v-for="(path, i) in result.data.paths" :id="`${maskId}-curve-${i}`" :key="path.id" :d="path.d" :pathLength="svgNumber(path.length)" />
        <mask :id="maskId" maskUnits="userSpaceOnUse" :x="svgNumber(-result.data.maskExtent)" :y="svgNumber(-result.data.maskExtent)" :width="svgNumber(result.data.maskExtent * 2)" :height="svgNumber(result.data.maskExtent * 2)" style="mask-type: luminance">
          <rect :x="svgNumber(-result.data.maskExtent)" :y="svgNumber(-result.data.maskExtent)" :width="svgNumber(result.data.maskExtent * 2)" :height="svgNumber(result.data.maskExtent * 2)" fill="white" />
          <template v-for="(path, i) in result.data.paths" :key="path.id">
            <use v-if="path.mask" :href="`#${maskId}-curve-${i}`" :stroke-dasharray="path.mask.array" :stroke-dashoffset="svgNumber(path.mask.offset)" fill="none" stroke="black" :stroke-width="svgNumber(result.data.gap * CROSSING_MASK_SCALE)" stroke-linecap="butt" stroke-linejoin="round" />
          </template>
        </mask>
      </defs>
      <g :transform="result.data.transform" fill="none" stroke="currentColor" :stroke-width="svgNumber(result.data.gap)" stroke-linecap="round" stroke-linejoin="round">
        <g :mask="`url(#${maskId})`">
          <template v-for="(path, i) in result.data.paths" :key="path.id">
            <use v-if="path.under" :href="`#${maskId}-curve-${i}`" :stroke-dasharray="path.under.array" :stroke-dashoffset="svgNumber(path.under.offset)" />
          </template>
        </g>
        <template v-for="(path, i) in result.data.paths" :key="path.id">
          <use v-if="path.over" :href="`#${maskId}-curve-${i}`" :stroke-dasharray="path.over.array" :stroke-dashoffset="svgNumber(path.over.offset)" />
        </template>
      </g>
    </svg>
    <div v-else class="knot-engine-v1-viewer__fallback" :role="error ? 'alert' : undefined">
      <slot name="fallback" :state="error ? 'error' : 'empty'" :error="error ? { message: error } : null">{{ error ?? text.empty }}</slot>
    </div>
    <div v-if="ready && showControls && interactive" class="knot-engine-v1-viewer__toolbar">
      <slot name="toolbar" :reset="resetView" :fit="fitToView" :zoom-in="zoomIn" :zoom-out="zoomOut" :ready="true" :guides="guides" :set-guides="setGuides" :touch-active="!!dragging">
        <button type="button" :aria-label="text.reset" :disabled="!active" @click="resetView"><span class="knot-engine-v1-viewer__button-icon" aria-hidden="true">↺</span></button>
        <button type="button" :aria-label="text.fit" :disabled="!active" @click="fitToView"><span class="knot-engine-v1-viewer__button-icon" aria-hidden="true">⌗</span></button>
        <button type="button" :aria-label="text.zoomIn" :disabled="!active" @click="zoomIn"><span class="knot-engine-v1-viewer__button-icon" aria-hidden="true">+</span></button>
        <button type="button" :aria-label="text.zoomOut" :disabled="!active" @click="zoomOut"><span class="knot-engine-v1-viewer__button-icon" aria-hidden="true">−</span></button>
        <GuideControls :guides="guides" :locale="locale" :messages="messages" :disabled="!active" @change="setGuides" />
      </slot>
    </div>
  </div>
</template>

