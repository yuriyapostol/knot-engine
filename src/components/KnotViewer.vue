<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CameraView, KnotModelV1, KnotAsset, RenderableModel, ViewerErrorCode, ValidationIssue } from '../core'
import { resolveKnotAsset, resolveKnotModelV1, ViewerError } from '../core'
import type { Quality } from '../geometry/build'
import { ViewerEngine, type CaptureOptions } from '../renderer/ViewerEngine'
import { messages as builtInMessages, type ViewerMessages } from '../locales'

export interface ViewerErrorEvent { code: ViewerErrorCode; message: string; issues?: ValidationIssue[]; recoverable: boolean }
const props = withDefaults(defineProps<{
  model?: KnotModelV1 | null; asset?: KnotAsset | null; representationId?: string; snapshotId?: string; label: string; description?: string; poster?: string
  locale?: 'uk' | 'en'; messages?: Partial<ViewerMessages>; theme?: 'light' | 'dark'
  quality?: Quality; active?: boolean; interactive?: boolean; showControls?: boolean; initialCamera?: CameraView
}>(), { locale: 'uk', theme: 'light', quality: 'medium', active: true, interactive: true, showControls: true })
const emit = defineEmits<{
  ready: [payload: { modelId?: string; schemaVersion: 1; warnings: string[] }]
  error: [payload: ViewerErrorEvent]
  'camera-change': [view: CameraView]
}>()
const slots = defineSlots<{
  toolbar(props: { reset: () => void; fit: () => void; zoomIn: () => void; zoomOut: () => void; ready: boolean; touchActive: boolean }): any
  fallback(props: { state: string; error: ViewerErrorEvent | null; poster?: string }): any
  loading(props: { state: string }): any
}>()
const root = ref<HTMLElement | null>(null)
const surface = ref<HTMLElement | null>(null)
const state = ref<'empty' | 'initializing' | 'ready' | 'error'>('empty')
const error = ref<ViewerErrorEvent | null>(null)
const touchActive = computed(() => props.interactive)
const text = computed(() => ({ ...builtInMessages[props.locale], ...props.messages }))
let engine: ViewerEngine | undefined
let resize: ResizeObserver | undefined
let intersection: IntersectionObserver | undefined
let generation = 0

function report(cause: ViewerError) {
  error.value = { code: cause.code, message: cause.message, issues: cause.issues, recoverable: cause.recoverable }
  state.value = 'error'
  emit('error', error.value)
}
function ensureEngine() {
  if (engine || !surface.value) return
  try {
    engine = new ViewerEngine(surface.value)
    engine.onReady = warnings => {
      if ((!props.model && !props.asset) || !engine) return
      state.value = 'ready'
      error.value = null
      emit('ready', { modelId: (props.asset ?? props.model)?.id, schemaVersion: 1, warnings })
    }
    engine.onError = report
    engine.onCameraChange = view => emit('camera-change', view)
    engine.setActive(props.active)
    engine.setInteractive(props.interactive)
    resize = new ResizeObserver(() => engine?.resize())
    resize.observe(surface.value)
    intersection = new IntersectionObserver(entries => engine?.setVisible(entries[0]?.isIntersecting ?? false))
    intersection.observe(root.value ?? surface.value)
    document.addEventListener('visibilitychange', onVisibility)
    engine.resize()
  } catch (cause) { report(cause instanceof ViewerError ? cause : new ViewerError('RENDER_FAILED', 'Unable to initialize renderer')) }
}
function onVisibility() { if (!document.hidden) engine?.resize() }
async function loadModel() {
  const current = ++generation
  if (!props.model && !props.asset) { engine?.clear(); state.value = 'empty'; error.value = null; return }
  let resolved: RenderableModel
  try {
    if (props.model && props.asset) throw new ViewerError('INVALID_MODEL', 'Supply either model or asset, not both', undefined, false)
    resolved = props.asset
      ? resolveKnotAsset(props.asset, { representationId: props.representationId, snapshotId: props.snapshotId })
      : resolveKnotModelV1(props.model)
  } catch (cause) {
    engine?.clear()
    report(cause instanceof ViewerError ? cause : new ViewerError('INVALID_MODEL', 'Unable to resolve input', undefined, false))
    return
  }
  engine?.clear()
  state.value = 'initializing'; error.value = null
  await nextTick()
  if (current !== generation || !surface.value) return
  ensureEngine()
  if (!engine) return
  try {
    engine.setModel(resolved, props.quality, props.initialCamera)
    engine.setTheme(props.theme)
    engine.resize()
  } catch (cause) { engine.clear(); report(cause instanceof ViewerError ? cause : new ViewerError('RENDER_FAILED', 'Unable to build model')) }
}
function retry() { engine?.dispose(); engine = undefined; resize?.disconnect(); intersection?.disconnect(); document.removeEventListener('visibilitychange', onVisibility); void loadModel() }
function onPointerDown(event: PointerEvent) { if (event.pointerType === 'mouse' && props.interactive) { root.value?.focus(); engine?.setInteractive(true) } }
function resetView() { engine?.resetView() }
function fitToView() { engine?.fitToView() }
function zoomIn() { engine?.zoom(0.8) }
function zoomOut() { engine?.zoom(1.25) }
function onKeydown(event: KeyboardEvent) {
  if (!props.interactive || !(event.target instanceof Node) || !root.value?.contains(event.target)) return
  if (event.target !== root.value) return
  const actions: Record<string, () => void> = { ArrowLeft: () => engine?.orbit(-0.14, 0), ArrowRight: () => engine?.orbit(0.14, 0), ArrowUp: () => engine?.orbit(0, -0.14), ArrowDown: () => engine?.orbit(0, 0.14), '+': zoomIn, '=': zoomIn, '-': zoomOut, Home: resetView }
  const action = actions[event.key]
  if (action) { event.preventDefault(); action() }
}
watch(() => [props.model, props.asset, props.representationId, props.snapshotId], loadModel)
watch(() => props.quality, loadModel)
watch(() => props.initialCamera, value => engine?.setInitialCamera(value))
watch(() => props.theme, value => engine?.setTheme(value))
watch(() => props.active, value => engine?.setActive(value))
watch(() => props.interactive, value => engine?.setInteractive(value))
onMounted(() => { void loadModel() })
onBeforeUnmount(() => { generation++; resize?.disconnect(); intersection?.disconnect(); document.removeEventListener('visibilitychange', onVisibility); engine?.dispose() })
defineExpose({ resetView, fitToView, capture: (options?: CaptureOptions) => engine?.capture(options) ?? Promise.reject(new ViewerError('CAPTURE_FAILED', 'Viewer is not ready')) })
</script>

<template>
  <div ref="root" class="knot-viewer" :data-theme="theme" :data-state="state" :aria-label="label" :aria-description="description" role="group" tabindex="0" @keydown="onKeydown">
    <div ref="surface" class="knot-viewer__surface" @pointerdown.capture="onPointerDown"></div>
    <div v-if="state !== 'ready'" class="knot-viewer__fallback" :role="state === 'error' ? 'alert' : undefined">
      <slot v-if="state === 'initializing'" name="loading" :state="state">
        <img v-if="poster" :src="poster" :alt="label" class="knot-viewer__poster">
        <span v-else>{{ text.loading }}</span>
      </slot>
      <slot v-else name="fallback" :state="state" :error="error" :poster="poster">
        <img v-if="poster" :src="poster" :alt="label" class="knot-viewer__poster">
        <span v-else>{{ state === 'empty' ? text.empty : text.unavailable }}</span>
        <button v-if="showControls && state === 'error' && error?.recoverable" type="button" @click="retry">{{ text.retry }}</button>
      </slot>
    </div>
    <div v-if="showControls && state === 'ready'" class="knot-viewer__toolbar">
      <slot name="toolbar" :reset="resetView" :fit="fitToView" :zoom-in="zoomIn" :zoom-out="zoomOut" :ready="state === 'ready'" :touch-active="touchActive">
        <button type="button" :title="text.reset" :aria-label="text.reset" @click="resetView">↺</button>
        <button type="button" :title="text.fit" :aria-label="text.fit" @click="fitToView">⌗</button>
        <button type="button" :title="text.zoomIn" :aria-label="text.zoomIn" @click="zoomIn">+</button>
        <button type="button" :title="text.zoomOut" :aria-label="text.zoomOut" @click="zoomOut">−</button>
      </slot>
    </div>
  </div>
</template>
