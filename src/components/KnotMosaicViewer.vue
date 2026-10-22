<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MOSAIC_DIAGRAM, selectRepresentation, validateMosaicDiagram, resolveRepresentationView, type KnotAsset, type MosaicDiagram, type KnotResourceRegistry, type Reference, type ViewDefinition } from '../core'
import { mosaicPaths } from './mosaicGeometry'
import { mosaicPanCenter } from './mosaicViewport'
import type { CaptureOptions } from './captureOptions'

export interface MosaicView { center: [number, number]; height: number }
const props = withDefaults(defineProps<{
  asset?: KnotAsset | null
  representationId?: string
  view?: Reference | ViewDefinition
  views?: ViewDefinition[]
  registries?: KnotResourceRegistry[]
  label: string
  description?: string
  locale?: 'uk' | 'en'
  theme?: 'light' | 'dark'
  active?: boolean
  interactive?: boolean
  showControls?: boolean
}>(), { locale: 'uk', theme: 'light', active: true, interactive: true, showControls: true })
const emit = defineEmits<{
  ready: [payload: { assetId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
  'view-change': [view: MosaicView]
}>()
const svg = ref<SVGSVGElement | null>(null)
const zoom = ref(1)
const center = ref<[number, number] | null>(null)
const dragging = ref<{ x: number; y: number; center: [number, number] } | null>(null)
const selection = computed(() => props.asset
  ? selectRepresentation(props.asset, { representationId: props.representationId, type: MOSAIC_DIAGRAM }, { registries: props.registries })
  : null)
const diagram = computed((): MosaicDiagram | null => {
  if (!selection.value?.ok) return null
  const result = validateMosaicDiagram(selection.value.representation.data)
  return result.valid ? result.diagram : null
})
const size = computed(() => diagram.value?.tiles.length ?? 1)
const resolvedView = computed(() => {
  if (!selection.value?.ok) return null
  return resolveRepresentationView(props.view, props.views, props.registries, props.asset?.namespaces)
})
const selectedView = computed(() => resolvedView.value?.ok ? resolvedView.value.view : null)
const viewError = computed(() => {
  if (!resolvedView.value) return null
  if (!resolvedView.value.ok) return resolvedView.value.message
  if (selectedView.value && (selectedView.value.space !== 'plane')) return 'Mosaic viewer requires a plane view'
  return null
})
const error = computed(() => {
  if (!props.asset) return null
  if (!selection.value?.ok) return selection.value?.issues[0]?.message ?? 'Invalid mosaic'
  return viewError.value
})
const paths = computed(() => diagram.value ? mosaicPaths(diagram.value) : [])
const ready = computed(() => !!diagram.value && !error.value)
const current = computed((): MosaicView => ({
  center: center.value ?? [size.value / 2, size.value / 2],
  height: size.value / zoom.value,
}))
const viewBox = computed(() => {
  const height = current.value.height
  return `${current.value.center[0] - height / 2} ${size.value - current.value.center[1] - height / 2} ${height} ${height}`
})
function announceView() { emit('view-change', current.value) }
function applyView() {
  const camera = selectedView.value?.space === 'plane' ? selectedView.value.camera : null
  center.value = camera ? [...camera.center] : null
  zoom.value = camera ? size.value / camera.height : 1
}
function resetView() { applyView(); announceView() }
function fitToView() { center.value = null; zoom.value = 1; announceView() }
function zoomIn() { zoom.value = Math.min(zoom.value * 1.25, 32); announceView() }
function zoomOut() { zoom.value = Math.max(zoom.value / 1.25, 0.25); announceView() }
function onWheel(event: WheelEvent) {
  if (!props.interactive || !props.active) return
  event.preventDefault()
  if (event.deltaY < 0) zoomIn()
  else zoomOut()
}
function onPointerDown(event: PointerEvent) {
  if (!props.interactive || !props.active || !ready.value || !svg.value || event.button !== 0) return
  dragging.value = { x: event.clientX, y: event.clientY, center: [...current.value.center] }
  svg.value.setPointerCapture(event.pointerId)
}
function onPointerMove(event: PointerEvent) {
  if (!dragging.value || !svg.value) return
  const rect = svg.value.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  center.value = mosaicPanCenter(
    dragging.value.center, event.clientX - dragging.value.x,
    event.clientY - dragging.value.y, current.value.height, rect.width, rect.height,
  )
  announceView()
}
function onPointerUp() { dragging.value = null }
function capture(options: CaptureOptions = {}): Promise<Blob> {
  if (!svg.value || !ready.value) return Promise.reject(new Error('Mosaic viewer is not ready'))
  const width = options.width ?? 1024, height = options.height ?? 1024
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048 || (options.format && options.format !== 'image/svg+xml') || (options.view && options.view !== 'current' && options.view !== 'model-preview')) return Promise.reject(new Error('Invalid mosaic capture dimensions, format or view'))
  const clone = svg.value.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (options.view === 'model-preview') clone.setAttribute('viewBox', `0 0 ${size.value} ${size.value}`)
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.color = getComputedStyle(svg.value).color
  return Promise.resolve(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
}
watch([diagram, selectedView], applyView, { immediate: true })
watch([ready, error], ([ok, problem]) => {
  if (ok && props.asset) emit('ready', { assetId: props.asset.id, schemaVersion: 1, warnings: [] })
  else if (problem) emit('error', { code: 'INVALID_MODEL', message: problem, recoverable: false })
}, { immediate: true })
defineExpose({ resetView, fitToView, capture })
</script>

<template>
  <div class="knot-engine-v1-viewer" :data-theme="theme" :data-state="ready ? 'ready' : error ? 'error' : 'empty'" :aria-label="label" :aria-description="description" role="group">
    <svg v-if="ready" ref="svg" class="knot-engine-v1-mosaic" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="label" @wheel="onWheel" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerUp" @lostpointercapture="onPointerUp">
      <g>
        <g v-for="path in paths" :key="path.key" :transform="path.transform">
          <path :d="path.d" fill="none" stroke="currentColor" stroke-width="0.095" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </svg>
    <div v-else class="knot-engine-v1-viewer__fallback" :role="error ? 'alert' : undefined">
      <slot name="fallback" :state="error ? 'error' : 'empty'" :error="error ? { message: error } : null">
        {{ error ?? (locale === 'uk' ? 'Немає даних' : 'No data') }}
      </slot>
    </div>
    <div v-if="ready && showControls && interactive" class="knot-engine-v1-viewer__toolbar">
      <slot name="toolbar" :reset="resetView" :fit="fitToView" :zoom-in="zoomIn" :zoom-out="zoomOut" :ready="true" :touch-active="false">
        <button type="button" aria-label="Reset view" @click="resetView">↺</button>
        <button type="button" aria-label="Fit to view" @click="fitToView">⌗</button>
        <button type="button" aria-label="Zoom in" @click="zoomIn">+</button>
        <button type="button" aria-label="Zoom out" @click="zoomOut">−</button>
      </slot>
    </div>
  </div>
</template>
