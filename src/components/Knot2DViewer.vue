<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GEOMETRY_2D, selectRepresentation, validateGeometry2D, type RawKnot, type RawResourceRegistry } from '../core'
import { locateCrossings } from './geometry2d'
import type { CaptureOptions } from './captureOptions'
const props = withDefaults(defineProps<{
  knot?: RawKnot | null; representationId?: string; registries?: RawResourceRegistry[]
  label: string; description?: string; theme?: 'light' | 'dark'; locale?: 'uk' | 'en'
  active?: boolean; interactive?: boolean; showControls?: boolean
}>(), { theme: 'light', locale: 'uk', active: true, interactive: true, showControls: true })
const emit = defineEmits<{
  ready: [payload: { knotId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
}>()
const svg = ref<SVGSVGElement | null>(null)
const zoom = ref(1)
const selection = computed(() => props.knot ? selectRepresentation(props.knot, { representationId: props.representationId, type: GEOMETRY_2D }, { registries: props.registries }) : null)
const result = computed(() => {
  if (!selection.value?.ok) return { data: null, error: selection.value && !selection.value.ok ? selection.value.issues[0]?.message : null }
  const checked = validateGeometry2D(selection.value.representation.data)
  if (!checked.valid) return { data: null, error: checked.issues[0]?.message }
  try {
    const positions = locateCrossings(checked.data)
    const points = checked.data.elements.flatMap(e => e.points)
    const xs = points.map(p => p[0]), ys = points.map(p => p[1])
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const extent = Math.max(maxX - minX, maxY - minY, 0.001)
    const gap = extent * 0.018
    const paths = checked.data.elements.map(e => ({
      id: e.id, d: e.points.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${-p[1]}`).join(' ') + (e.closed ? ' Z' : '')
    }))
    const over = positions.filter(p => p.over).map(p => {
      const curve = checked.data.elements.find(e => e.id === p.element)!
      const a = curve.points[p.segment], b = curve.points[(p.segment + 1) % curve.points.length]
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return { ...p, dx: (b[0] - a[0]) / length, dy: (b[1] - a[1]) / length }
    })
    return { data: { paths, over, bounds: [minX, -maxY, Math.max(maxX - minX, extent * 0.05), Math.max(maxY - minY, extent * 0.05)] as number[], gap }, error: null }
  } catch (e) { return { data: null, error: (e as Error).message } }
})
const viewBox = computed(() => {
  const b = result.value.data?.bounds ?? [0, 0, 1, 1]
  const side = Math.max(b[2], b[3]) * 1.12 / zoom.value
  return `${b[0] + b[2] / 2 - side / 2} ${b[1] + b[3] / 2 - side / 2} ${side} ${side}`
})
function resetView() { zoom.value = 1 }
function fitToView() { zoom.value = 1 }
function zoomIn() { zoom.value = Math.min(zoom.value * 1.25, 32) }
function zoomOut() { zoom.value = Math.max(zoom.value / 1.25, 0.25) }
function capture(options: CaptureOptions = {}): Promise<Blob> {
  if (!svg.value || !result.value.data) return Promise.reject(new Error('2D viewer is not ready'))
  const width = options.width ?? 1024, height = options.height ?? 1024
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048 || (options.format && options.format !== 'image/svg+xml')) return Promise.reject(new Error('Invalid 2D capture options'))
  const clone = svg.value.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width)); clone.setAttribute('height', String(height))
  return Promise.resolve(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }))
}
watch(result, value => {
  if (value.data && props.knot) emit('ready', { knotId: props.knot.id, schemaVersion: 1, warnings: [] })
  else if (value.error) emit('error', { code: 'INVALID_MODEL', message: value.error, recoverable: false })
}, { immediate: true })
defineExpose({ resetView, fitToView, capture })
</script>
<template>
  <div class="knot-engine-v1-viewer" :data-theme="theme" :data-state="result.data ? 'ready' : result.error ? 'error' : 'empty'" :aria-label="label" role="group">
    <svg v-if="result.data" ref="svg" class="knot-engine-v1-mosaic" :viewBox="viewBox" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="label">
      <g fill="none" stroke="currentColor" :stroke-width="result.data.gap" stroke-linecap="round" stroke-linejoin="round">
        <path v-for="path in result.data.paths" :key="path.id" :d="path.d" />
        <g v-for="(p, i) in result.data.over" :key="i">
          <circle :cx="p.x" :cy="-p.y" :r="result.data.gap * 1.15" :fill="theme === 'dark' ? '#141414' : '#ffffff'" stroke="none" />
          <path :d="`M ${p.x - result.data.gap * 1.5} ${-p.y} L ${p.x + result.data.gap * 1.5} ${-p.y}`" />
        </g>
      </g>
    </svg>
    <div v-else class="knot-engine-v1-viewer__fallback">{{ result.error ?? (locale === 'uk' ? 'Немає даних' : 'No data') }}</div>
    <div v-if="result.data && showControls && interactive" class="knot-engine-v1-viewer__toolbar">
      <button type="button" @click="resetView">↺</button>
      <button type="button" @click="fitToView">⌗</button>
      <button type="button" @click="zoomIn">+</button>
      <button type="button" @click="zoomOut">−</button>
    </div>
  </div>
</template>
