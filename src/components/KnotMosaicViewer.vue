<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MOSAIC_DIAGRAM, selectRepresentation, validateMosaicDiagram, type KnotAsset, type MosaicDiagram } from '../core'
import { mosaicPaths } from './mosaicGeometry'

const props = withDefaults(defineProps<{
  asset?: KnotAsset | null
  representationId?: string
  label: string
  description?: string
  locale?: 'uk' | 'en'
  theme?: 'light' | 'dark'
  interactive?: boolean
  showControls?: boolean
}>(), { locale: 'uk', theme: 'light', interactive: true, showControls: true })
const emit = defineEmits<{
  ready: [payload: { assetId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
}>()
const zoom = ref(1)
const selection = computed(() => props.asset
  ? selectRepresentation(props.asset, { representationId: props.representationId, type: MOSAIC_DIAGRAM })
  : null)
const diagram = computed((): MosaicDiagram | null => {
  if (!selection.value?.ok) return null
  const result = validateMosaicDiagram(selection.value.representation.data)
  return result.valid ? result.diagram : null
})
const error = computed(() => props.asset && !selection.value?.ok
  ? selection.value?.issues[0]?.message ?? 'Invalid mosaic'
  : null)
const paths = computed(() => diagram.value ? mosaicPaths(diagram.value) : [])
const size = computed(() => diagram.value?.tiles.length ?? 1)
const view = computed(() => {
  const n = size.value, extent = n / zoom.value, offset = (n - extent) / 2
  return `${offset} ${offset} ${extent} ${extent}`
})
function resetView() { zoom.value = 1 }
function fitToView() { resetView() }
function zoomIn() { zoom.value = Math.min(zoom.value * 1.25, 16) }
function zoomOut() { zoom.value = Math.max(zoom.value / 1.25, 1) }
function capture(): Promise<Blob> {
  return Promise.reject(new Error('SVG capture is not implemented'))
}
watch([diagram, error], ([value, problem]) => {
  if (value && props.asset) emit('ready', { assetId: props.asset.id, schemaVersion: 1, warnings: [] })
  else if (problem) emit('error', { code: 'INVALID_MODEL', message: problem, recoverable: false })
}, { immediate: true })
defineExpose({ resetView, fitToView, capture })
</script>

<template>
  <div class="knot-engine-v1-viewer" :data-theme="theme" :data-state="diagram ? 'ready' : error ? 'error' : 'empty'" :aria-label="label" :aria-description="description" role="group">
    <svg v-if="diagram" class="knot-engine-v1-mosaic" :viewBox="view" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="label">
      <g v-for="path in paths" :key="path.key" :transform="path.transform">
        <path :d="path.d" fill="none" stroke="currentColor" stroke-width="0.095" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
    <div v-else class="knot-engine-v1-viewer__fallback" :role="error ? 'alert' :undefined">
      <slot name="fallback" :state="error ? 'error' : 'empty'" :error="error ? { message: error } : null">
        {{ error ?? (locale === 'uk' ? 'Немає даних' : 'No data') }}
      </slot>
    </div>
    <div v-if="diagram && showControls && interactive" class="knot-engine-v1-viewer__toolbar">
      <slot name="toolbar" :reset="resetView" :fit="fitToView" :zoom-in="zoomIn" :zoom-out="zoomOut" :ready="true" :touch-active="false">
        <button type="button" aria-label="Reset view" @click="resetView">↺</button>
        <button type="button" aria-label="Zoom in" @click="zoomIn">+</button>
        <button type="button" aria-label="Zoom out" @click="zoomOut">−</button>
      </slot>
    </div>
  </div>
</template>
