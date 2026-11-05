import { onScopeDispose, ref, watch, type Ref } from 'vue'

/** Shared pointer tracking for SVG plane viewers: one pointer pans, two zoom. */
export function usePlaneGestures(
  svg: Ref<SVGSVGElement | null>,
  enabled: Ref<boolean>,
  pan: (dx: number, dy: number) => void,
  zoom: (factor: number) => void,
) {
  const pointers = new Map<number, { x: number; y: number }>()
  const dragging = ref(false)
  function distance() {
    const [a, b] = [...pointers.values()]
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0
  }
  function onPointerDown(event: PointerEvent) {
    if (!enabled.value || !svg.value || event.button !== 0 || pointers.has(event.pointerId) || pointers.size >= 2) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragging.value = true
    svg.value.setPointerCapture?.(event.pointerId)
  }
  function onPointerMove(event: PointerEvent) {
    const previous = pointers.get(event.pointerId)
    if (!enabled.value || !previous) return
    const before = distance()
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) {
      const after = distance()
      if (before > 0 && after > 0) zoom(before / after)
    } else pan(event.clientX - previous.x, event.clientY - previous.y)
  }
  function onPointerUp(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return
    dragging.value = pointers.size > 0
    if (svg.value?.hasPointerCapture?.(event.pointerId)) svg.value.releasePointerCapture(event.pointerId)
  }
  function clear() {
    const ids = [...pointers.keys()]
    pointers.clear()
    dragging.value = false
    for (const id of ids) {
      if (svg.value?.hasPointerCapture?.(id)) svg.value.releasePointerCapture(id)
    }
  }
  watch(enabled, value => { if (!value) clear() }, { flush: 'sync' })
  watch(svg, clear)
  onScopeDispose(clear)
  return { dragging, onPointerDown, onPointerMove, onPointerUp, clear }
}
