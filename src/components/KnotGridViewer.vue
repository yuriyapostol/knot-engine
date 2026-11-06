<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GRID_DIAGRAM, selectRepresentation, validateGridDiagram, resolveRepresentationView, type RawKnot, type RawResourceRegistry, type Reference, type ViewDefinition } from '../core'
import { gridGeometry } from './gridGeometry'
import { mosaicPanCenter } from './mosaicViewport'
import { usePlaneGestures } from './usePlaneGestures'
import { messages as defaults, type ViewerMessages } from '../locales'
import type { CaptureOptions } from './captureOptions'

export interface GridView { center: [number, number]; height: number }

const props = withDefaults(defineProps<{
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
  ready: [payload: { knotId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
  'view-change': [view: GridView]
}>()
const text = computed(() => ({ ...defaults[props.locale], ...props.messages }))
const svg = ref<SVGSVGElement | null>(null)
const camera = ref<GridView>({ center: [0, 0], height: 1 })
const canInteract = computed(() => props.active && props.interactive)
const selection = computed(() => props.knot ? selectRepresentation(props.knot, { representationId: props.representationId, type: GRID_DIAGRAM }, { registries: props.registries }) : null)
const result = computed(() => {
  if (!selection.value?.ok) return { data: null, error: selection.value && !selection.value.ok ? selection.value.issues[0]?.message : null }
  const checked = validateGridDiagram(selection.value.representation.data)
  if (!checked.valid) return { data: null, error: checked.issues[0]?.message }
  return { data: gridGeometry(checked.data), error: null }
})
const resolvedView = computed(() => resolveRepresentationView(props.view, props.views, props.registries, props.knot?.namespaces))
const error = computed(() => {
  if (!props.knot) return null
  if (result.value.error) return result.value.error
  if (!resolvedView.value.ok) return resolvedView.value.message
  if (resolvedView.value.view && resolvedView.value.view.space !== 'plane') return 'Grid viewer requires a plane view'
  return null
})
const ready = computed(() => !!result.value.data && !error.value)
const initial = computed((): GridView => {
  const view = resolvedView.value.ok ? resolvedView.value.view : null
  return view?.space === 'plane' ? { center: [...view.camera.center], height: view.camera.height } : result.value.data?.fit ?? { center: [0, 0], height: 1 }
})
function box(view: GridView) {
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
  if (!svg.value || !ready.value) return Promise.reject(new Error('Grid viewer is not ready'))
  const width = options.width ?? 1024, height = options.height ?? 1024
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048 ||
      (options.format && options.format !== 'image/svg+xml') || (options.view && options.view !== 'current' && options.view !== 'model-preview'))
    return Promise.reject(new Error('Invalid grid capture dimensions, format or view'))
  const clone = svg.value.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('xmlns')
  clone.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('viewBox', box(options.view === 'model-preview' ? result.value.data!.fit : camera.value))
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
    <svg v-if="ready && result.data" ref="svg" class="knot-engine-v1-grid" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="label" :tabindex="canInteract ? 0 : undefined" :style="{ touchAction: canInteract ? 'none' : 'auto' }" @wheel="onWheel" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @lostpointercapture="onPointerUp" @keydown="onKeyDown">
      <g transform="scale(1 -1)" fill="none" stroke="currentColor" stroke-width="0.07" stroke-linecap="round" stroke-linejoin="round">
        <g data-grid-strands="horizontal">
          <line v-for="(segment, i) in result.data.horizontal" :key="i" :x1="segment.start[0]" :y1="segment.start[1]" :x2="segment.end[0]" :y2="segment.end[1]" />
        </g>
        <g data-grid-strands="vertical">
          <line v-for="(segment, i) in result.data.vertical" :key="i" :x1="segment.start[0]" :y1="segment.start[1]" :x2="segment.end[0]" :y2="segment.end[1]" />
        </g>
        <g v-for="(marker, i) in result.data.markers" :key="i" :data-grid-marker="marker.kind" :transform="`translate(${marker.position[0]} ${marker.position[1]})`" stroke-width="0.055">
          <path v-if="marker.kind === 'x'" d="M -0.12 -0.12 L 0.12 0.12 M -0.12 0.12 L 0.12 -0.12" />
          <circle v-else r="0.14" />
        </g>
      </g>
    </svg>
    <div v-else class="knot-engine-v1-viewer__fallback" :role="error ? 'alert' : undefined">
      <slot name="fallback" :state="error ? 'error' : 'empty'" :error="error ? { message: error } : null">{{ error ?? text.empty }}</slot>
    </div>
    <div v-if="ready && showControls && interactive" class="knot-engine-v1-viewer__toolbar">
      <slot name="toolbar" :reset="resetView" :fit="fitToView" :zoom-in="zoomIn" :zoom-out="zoomOut" :ready="true" :touch-active="!!dragging">
        <button type="button" :aria-label="text.reset" :disabled="!active" @click="resetView">↺</button>
        <button type="button" :aria-label="text.fit" :disabled="!active" @click="fitToView">⌗</button>
        <button type="button" :aria-label="text.zoomIn" :disabled="!active" @click="zoomIn">+</button>
        <button type="button" :aria-label="text.zoomOut" :disabled="!active" @click="zoomOut">−</button>
      </slot>
    </div>
  </div>
</template>

