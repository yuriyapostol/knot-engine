<script setup lang="ts">
import { computed, ref } from 'vue'
import Knot3DViewer from './Knot3DViewer.vue'
import KnotMosaicViewer from './KnotMosaicViewer.vue'
import { MOSAIC_DIAGRAM, SPATIAL_CURVE, selectRepresentation, type KnotAsset, type Camera3D, type KnotResourceRegistry, type Reference, type ViewDefinition } from '../core'
import type { ViewerMessages } from '../locales'
import type { ViewerRegistry } from './viewerRegistry'
import { createViewerRegistry } from './viewerRegistry'
import type { CaptureOptions } from '../renderer/ViewerEngine'

const props = withDefaults(defineProps<{
  asset?: KnotAsset | null
  representationId?: string
  view?: Reference | ViewDefinition
  registries?: KnotResourceRegistry[]
  initialCamera?: Camera3D
  messages?: Partial<ViewerMessages>
  registry?: ViewerRegistry
  label: string
  description?: string
  poster?: string
  locale?: 'uk' | 'en'
  theme?: 'light' | 'dark'
  quality?: 'low' | 'medium' | 'high'
  active?: boolean
  interactive?: boolean
  showControls?: boolean
}>(), { locale: 'uk', theme: 'light', quality: 'medium', active: true, interactive: true, showControls: true })
const emit = defineEmits<{
  ready: [payload: { assetId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
  'camera-change': [view: unknown]
}>()
const builtIns = createViewerRegistry([
  { typeUri: SPATIAL_CURVE, component: Knot3DViewer, capabilities: { orbit: true, pan: true, zoom: true, capture: ['png'] } },
  { typeUri: MOSAIC_DIAGRAM, component: KnotMosaicViewer, capabilities: { zoom: true } },
])
const viewer = ref<{ resetView: () => void; fitToView: () => void; capture: (options?: CaptureOptions) => Promise<Blob> } | null>(null)
const selection = computed(() => props.asset ? selectRepresentation(props.asset, { representationId: props.representationId }) : null)
const selected = computed(() => {
  if (!selection.value?.ok) return null
  return (props.registry ?? builtIns).get(selection.value.typeUri) ?? null
})
const failure = computed(() => {
  if (!props.asset) return null
  if (!selection.value?.ok) return selection.value?.issues[0]?.message ?? 'Unable to select representation'
  if (!selected.value) return `Unsupported viewer type: ${selection.value.typeUri}`
  return null
})
function resetView() { viewer.value?.resetView() }
function fitToView() { viewer.value?.fitToView() }
function capture(options?: CaptureOptions) {
  return viewer.value?.capture(options) ?? Promise.reject(new Error('Viewer is not ready'))
}
defineExpose({ resetView, fitToView, capture })
</script>

<template>
  <component
    :is="selected.component"
    v-if="asset && selection?.ok && selected"
    ref="viewer"
    :asset="asset"
    :representation-id="selection.representation.id"
    :view="view"
    :registries="registries"
    :initial-camera="initialCamera"
    :messages="messages"
    :label="label"
    :description="description"
    :poster="poster"
    :locale="locale"
    :theme="theme"
    :quality="quality"
    :active="active"
    :interactive="interactive"
    :show-controls="showControls"
    @ready="emit('ready', $event)"
    @error="emit('error', $event)"
    @camera-change="emit('camera-change', $event)"
  >
    <template v-if="$slots.toolbar" #toolbar="slotProps"><slot name="toolbar" v-bind="slotProps" /></template>
    <template v-if="$slots.loading" #loading="slotProps"><slot name="loading" v-bind="slotProps" /></template>
    <template v-if="$slots.fallback" #fallback="slotProps"><slot name="fallback" v-bind="slotProps" /></template>
  </component>
  <div v-else class="knot-engine-v1-viewer" :data-theme="theme" :data-state="failure ? 'error' : 'empty'" :aria-label="label" role="group">
    <div class="knot-engine-v1-viewer__fallback" :role="failure ? 'alert' : undefined">
      <slot name="fallback" :state="failure ? 'error' : 'empty'" :error="failure ? { message: failure } : null" :poster="poster">
        <span>{{ failure ?? (locale === 'uk' ? 'Немає даних' : 'No data') }}</span>
      </slot>
    </div>
  </div>
</template>
