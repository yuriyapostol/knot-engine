<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { IMAGE_REPRESENTATION, selectRepresentation, validateImageRepresentation, type RawKnot, type RawResourceRegistry } from '../core'
import type { CaptureOptions } from './captureOptions'
const props = withDefaults(defineProps<{
  knot?: RawKnot | null; representationId?: string; registries?: RawResourceRegistry[];
  label: string; description?: string; locale?: 'en' | 'uk'; theme?: 'light' | 'dark';
  active?: boolean; interactive?: boolean; showControls?: boolean; baseUrl?: string
}>(), { locale: 'en', theme: 'light', active: true, interactive: true, showControls: true })
const emit = defineEmits<{
  ready: [payload: { knotId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: { code: string; message: string; recoverable: boolean }]
  'view-change': [view: { zoom: number; x: number; y: number }]
}>()
const selection = computed(() => props.knot ? selectRepresentation(props.knot, { representationId: props.representationId, type: IMAGE_REPRESENTATION }, { registries: props.registries }) : null)
const checked = computed(() => selection.value?.ok ? validateImageRepresentation(selection.value.representation.data) : null)
const error = computed(() => !selection.value?.ok ? selection.value?.issues[0]?.message : checked.value && !checked.value.valid ? checked.value.issues[0]?.message : null)
const src = computed(() => {
  if (!checked.value?.valid) return ''
  const value = checked.value.data.src
  return props.baseUrl && !/^(?:https:|data:)/i.test(value) ? new URL(value, props.baseUrl).href : value
})
const zoom = ref(1), x = ref(0), y = ref(0), image = ref<HTMLImageElement | null>(null)
const touches = new Map<number, { x: number; y: number }>()
let pinchDistance = 0
const loaded = ref(false), drag = ref<{ x: number; y: number; originX: number; originY: number } | null>(null)
const ready = computed(() => !!src.value && loaded.value && !error.value)
function announce() { emit('view-change', { zoom: zoom.value, x: x.value, y: y.value }) }
function resetView() { zoom.value = 1; x.value = 0; y.value = 0; announce() }
function fitToView() { resetView() }
function scale(factor: number) { zoom.value = Math.max(0.1, Math.min(32, zoom.value * factor)); announce() }
function wheel(e: WheelEvent) { if (!props.interactive || !props.active) return; e.preventDefault(); scale(e.deltaY < 0 ? 1.2 : 1 / 1.2) }
function pointerDown(e: PointerEvent) {
  if (!props.interactive || !props.active) return
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (touches.size === 1) drag.value = { x: e.clientX, y: e.clientY, originX: x.value, originY: y.value }
  else { drag.value = null; pinchDistance = distance() }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function distance() { const [a, b] = [...touches.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 }
function pointerMove(e: PointerEvent) {
  if (!touches.has(e.pointerId)) return
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (touches.size >= 2) { const next = distance(); if (pinchDistance > 0 && next > 0) scale(next / pinchDistance); pinchDistance = next; return }
  if (!drag.value) return
  x.value = drag.value.originX + e.clientX - drag.value.x; y.value = drag.value.originY + e.clientY - drag.value.y; announce()
}
function pointerUp(e: PointerEvent) { touches.delete(e.pointerId); drag.value = null; pinchDistance = 0 }
function capture(options: CaptureOptions = {}): Promise<Blob> {
  if (!ready.value || !image.value) return Promise.reject(new Error('Image viewer is not ready'))
  if (options.format && options.format !== 'image/png') return Promise.reject(new Error('Image viewer supports PNG capture'))
  const width = options.width ?? 1024, height = options.height ?? 1024
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048) return Promise.reject(new Error('Invalid capture dimensions'))
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas unavailable'))
  try {
    if (options.transparent === false) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height) }
    const fit = Math.min(width / image.value.naturalWidth, height / image.value.naturalHeight)
    const w = image.value.naturalWidth * fit * zoom.value, h = image.value.naturalHeight * fit * zoom.value
    ctx.drawImage(image.value, (width - w) / 2 + x.value, (height - h) / 2 + y.value, w, h)
    return new Promise((resolve, reject) => { try { canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image capture blocked by browser origin policy')), 'image/png') } catch (e) { reject(e) } })
  } catch (e) { return Promise.reject(e) }
}
watch(src, () => { loaded.value = false; resetView() })
function onLoad() { loaded.value = true; if (props.knot) emit('ready', { knotId: props.knot.id, schemaVersion: 1, warnings: [] }) }
function onError() { loaded.value = false; emit('error', { code: 'INVALID_MODEL', message: 'Unable to load image', recoverable: false }) }
defineExpose({ resetView, fitToView, capture })
</script>
<template>
  <div class="knot-engine-v1-viewer" :data-theme="theme" :data-state="ready ? 'ready' : error ? 'error' : 'empty'" :aria-label="label" role="group">
    <div v-if="src && !error" style="width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none" @wheel="wheel" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp">
      <img ref="image" :src="src" :alt="label" draggable="false" style="max-width:100%;max-height:100%;object-fit:contain;user-select:none" :style="{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }" @load="onLoad" @error="onError" />
    </div>
    <div v-else class="knot-engine-v1-viewer__fallback" role="alert">{{ error ?? (locale === 'uk' ? 'Немає даних' : 'No data') }}</div>
    <div v-if="ready && showControls && interactive" class="knot-engine-v1-viewer__toolbar">
      <button type="button" :disabled="!active" @click="resetView">{{ locale === 'uk' ? 'Скинути' : 'Reset' }}</button>
      <button type="button" :disabled="!active" @click="fitToView">{{ locale === 'uk' ? 'Вписати' : 'Fit' }}</button>
      <button type="button" :disabled="!active" @click="scale(1.25)">+</button>
      <button type="button" :disabled="!active" @click="scale(0.8)">−</button>
    </div>
  </div>
</template>
