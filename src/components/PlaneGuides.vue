<script lang="ts">
let nextGuideId = 0
</script>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { boundedGuideStep, guideLabel, guideStep, guideTicks, type ResolvedViewerGuides } from './guides'
const props = defineProps<{
  guides: ResolvedViewerGuides
  /** SVG viewport, in its native (downward-positive Y) coordinates. */
  box: string
  size?: number
  mode: 'geometry' | 'grid' | 'mosaic'
}>()
const id = ref(`knot-guides-${useId().replace(/[^a-zA-Z0-9_-]/g, '-')}`)
const root = ref<SVGGElement | null>(null)
const aspect = ref(1)
let observer: ResizeObserver | undefined
onMounted(() => {
  id.value += `-${nextGuideId++}`
  const svg = root.value?.ownerSVGElement
  if (!svg) return
  const resize = () => { const rect = svg.getBoundingClientRect(); aspect.value = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1 }
  resize()
  if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize); observer.observe(svg) }
})
onBeforeUnmount(() => observer?.disconnect())
const viewport = computed(() => {
  const [x, y, width, height] = props.box.split(' ').map(Number) as [number, number, number, number]
  const w = width * Math.max(1, aspect.value), h = height / Math.min(1, aspect.value)
  return [x - (w - width) / 2, y - (h - height) / 2, w, h]
})
const height = computed(() => viewport.value[3]!)
const screenExtent = computed(() => Number(props.box.split(' ')[3]))
const step = computed(() => props.mode === 'geometry' ? props.guides.grid.step === 'auto' ? guideStep(screenExtent.value) : boundedGuideStep(props.guides.grid.step, screenExtent.value, 200) : 1)
const field = computed(() => {
  const size = props.size ?? 1
  return [0, props.mode === 'grid' ? -size : 0, size, size] as const
})
const area = computed(() => props.mode === 'geometry' ? viewport.value : field.value)
const unit = computed(() => screenExtent.value / 500)
const indexStride = computed(() => Math.max(1, Math.ceil(screenExtent.value / 20)))
const xs = computed(() => props.mode === 'geometry'
  ? guideTicks(viewport.value[0]!, viewport.value[0]! + viewport.value[2]!, step.value)
  : guideTicks(Math.max(0, Math.ceil(viewport.value[0]! - 0.5)), Math.min(field.value[2] - 1, Math.floor(viewport.value[0]! + viewport.value[2]! - 0.5)), indexStride.value).map(v => v + 0.5))
const ys = computed(() => props.mode === 'geometry'
  ? guideTicks(-viewport.value[1]! - height.value, -viewport.value[1]!, step.value)
  : guideTicks(Math.max(0, Math.ceil(viewport.value[1]! - field.value[1] - 0.5)), Math.min(field.value[3] - 1, Math.floor(viewport.value[1]! + height.value - field.value[1] - 0.5)), indexStride.value).map(v => field.value[1] + v + 0.5))
// Index axes follow the left edge and the first row's edge of each field.
const axisX = computed(() => props.mode === 'geometry' ? 0 : field.value[0])
const axisY = computed(() => props.mode === 'geometry' ? 0 : props.mode === 'mosaic' ? field.value[1] : field.value[1] + field.value[3])
// Evaluate each axis separately, including the letterboxed part of the SVG viewport.
// Reserve a conservative glyph width plus the label offset and a small edge gap.
const rowsOutside = computed(() => props.mode !== 'geometry' && axisX.value - viewport.value[0]! >= (String((props.size ?? 1) - 1).length * 8 + 8) * unit.value)
const columnsOutside = computed(() => {
  if (props.mode === 'geometry') return false
  const space = props.mode === 'mosaic' ? axisY.value - viewport.value[1]! : viewport.value[1]! + height.value - axisY.value
  return space >= 22 * unit.value
})
const columnsBelow = computed(() => props.mode === 'mosaic' ? !columnsOutside.value : columnsOutside.value)
function rowLabel(y: number) { return String(props.mode === 'mosaic' ? Math.floor(y - field.value[1]) : Math.floor(field.value[1] + field.value[3] - y)) }
</script>
<template>
  <g ref="root" data-viewer-guides="plane" pointer-events="none" aria-hidden="true" fill="none" stroke="currentColor" :stroke-width="unit">
    <template v-if="guides.grid.visible">
      <defs>
        <pattern :id="id" patternUnits="userSpaceOnUse" overflow="visible" :width="step" :height="step" x="0" y="0">
          <!-- Only top and left edges; adjacent tiles supply the other edges. -->
          <path :d="`M ${step} 0 H 0 V ${step}`" stroke-opacity="0.4" />
        </pattern>
      </defs>
      <rect data-guide-grid="" :x="area[0]" :y="area[1]" :width="area[2]" :height="area[3]" :fill="`url(#${id})`" stroke="none" />
      <!-- The repeated cell supplies top/left edges; close only bottom/right. -->
      <path v-if="mode !== 'geometry'" data-guide-grid-edges="" :d="`M ${field[0] + field[2]} ${field[1]} V ${field[1] + field[3]} H ${field[0]}`" stroke-opacity="0.3" />
    </template>
    <g v-if="guides.axes.visible" data-guide-axes="" stroke-opacity="0.6">
      <path data-guide-axis="x" :d="mode === 'geometry' ? `M ${viewport[0]} 0 h ${viewport[2]}` : `M ${field[0]} ${axisY} h ${field[2]}`" />
      <path data-guide-axis="y" :d="mode === 'geometry' ? `M 0 ${viewport[1]} v ${height}` : `M ${axisX} ${field[1]} v ${field[3]}`" />
      <template v-if="guides.axes.ticks">
        <path data-guide-tick="x" v-for="x in xs" :key="`x${x}`" :d="`M ${x} ${axisY - 3 * unit} v ${6 * unit}`" />
        <path data-guide-tick="y" v-for="y in ys" :key="`y${y}`" :d="`M ${axisX - 3 * unit} ${mode === 'geometry' ? -y : y} h ${6 * unit}`" />
      </template>
      <g v-if="guides.axes.labels" fill="currentColor" stroke="none" :font-size="12 * unit" font-family="sans-serif">
        <template v-if="mode === 'geometry'">
          <text :x="viewport[0]! + viewport[2]! - 6 * unit" :y="-8 * unit" text-anchor="end">X</text>
          <text :x="8 * unit" :y="viewport[1]! + 14 * unit">Y</text>
        </template>
        <text v-for="x in xs" :key="`x${x}`" :x="x" :y="axisY + (columnsBelow ? 6 : -6) * unit" :dominant-baseline="columnsBelow ? 'hanging' : undefined" text-anchor="middle" data-guide-index="column">{{ mode === 'geometry' ? guideLabel(x) : Math.floor(x) }}</text>
        <text v-for="y in ys" :key="`y${y}`" :x="axisX + (rowsOutside ? -6 : 6) * unit" :text-anchor="rowsOutside ? 'end' : 'start'" :y="mode === 'geometry' ? -y : y" dominant-baseline="middle" data-guide-index="row">{{ mode === 'geometry' ? guideLabel(y) : rowLabel(y) }}</text>
      </g>
    </g>
  </g>
</template>
