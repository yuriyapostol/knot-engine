import { ref, watch } from 'vue'

export type GuidePlane = 'xy' | 'xz' | 'yz'
/** Application-owned presentation; omitted options keep all guides hidden. */
export interface ViewerGuides {
  grid?: { visible?: boolean; step?: number | 'auto'; planes?: readonly GuidePlane[] }
  axes?: { visible?: boolean; ticks?: boolean; labels?: boolean }
}
export interface ResolvedViewerGuides {
  grid: { visible: boolean; step: number | 'auto'; planes: GuidePlane[] }
  axes: { visible: boolean; ticks: boolean; labels: boolean }
}
export function resolveGuides(value: ViewerGuides = {}): ResolvedViewerGuides {
  const step = value.grid?.step
  return {
    grid: { visible: value.grid?.visible ?? false, step: typeof step === 'number' && Number.isFinite(step) && step > 0 ? step : 'auto', planes: [...new Set(value.grid?.planes ?? ['xy' as GuidePlane])].filter(p => ['xy', 'xz', 'yz'].includes(p)) },
    axes: { visible: value.axes?.visible ?? false, ticks: value.axes?.ticks ?? true, labels: value.axes?.labels ?? true },
  }
}
export function useGuides(source: () => ViewerGuides | undefined, changed: (value: ResolvedViewerGuides) => void) {
  const guides = ref(resolveGuides(source()))
  watch(source, value => { guides.value = resolveGuides(value) }, { deep: true })
  function setGuides(value: ViewerGuides) {
    guides.value = resolveGuides(value)
    changed(resolveGuides(guides.value))
  }
  return { guides, setGuides }
}
/** About ten intervals, choosing the familiar 1/2/5 sequence. */
export function guideStep(extent: number): number {
  const target = extent / 10
  if (!Number.isFinite(target) || target <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(target))
  const fraction = target / power
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
}
/** Retain integer multiples of explicit spacing when thinning a dense grid. */
export function boundedGuideStep(step: number, extent: number, limit: number): number {
  const factor = Math.max(1, Math.ceil(extent / step / limit))
  return Number.isFinite(factor) ? step * factor : extent / limit
}
/** Bound work even for an explicitly requested very small step. */
export function guideTicks(min: number, max: number, step: number, limit = 80): number[] {
  if (![min, max, step].every(Number.isFinite) || step <= 0 || max < min) return []
  const stride = step * Math.max(1, Math.ceil((max - min) / step / limit))
  const start = Math.ceil(min / stride) * stride
  return Array.from({ length: Math.min(limit + 1, Math.max(0, Math.floor((max - start) / stride + 1e-9) + 1)) }, (_, i) => start + i * stride)
}
export function guideLabel(value: number): string {
  return String(Number(value.toPrecision(6)))
}
