// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, shallowReactive, type Component } from 'vue'
import Knot2DViewer from '../src/components/Knot2DViewer.vue'
import KnotGridViewer from '../src/components/KnotGridViewer.vue'
import KnotMosaicViewer from '../src/components/KnotMosaicViewer.vue'
import geometry from '../v1/examples/knots/geometry-crossing-demo.json'
import grid from '../v1/examples/knots/grid-diagram.json'
import mosaic from '../v1/examples/knots/mosaic-diagram.json'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.restoreAllMocks() })
function pointer(svg: Element, type: string, id: number, x: number, y = 0) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0, pointerType: 'touch' })
  svg.dispatchEvent(event)
}
for (const [name, component, knot] of [
  ['2D', Knot2DViewer, geometry], ['Grid', KnotGridViewer, grid], ['Mosaic', KnotMosaicViewer, mosaic],
] as const) describe(`${name} touch gestures`, () => {
  async function mount() {
    const props = shallowReactive({ active: true, interactive: true })
    const root = document.createElement('div'); document.body.append(root)
    const events: { center: [number, number]; height: number }[] = []
    const app = createApp({ render: () => h(component as Component, {
      knot, label: name, ...props, 'onView-change': (view: typeof events[number]) => events.push(view),
    }) })
    app.mount(root); cleanups.push(() => { app.unmount(); root.remove() }); await nextTick()
    const svg = root.querySelector('svg')!
    expect(svg).not.toBeNull()
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 400, height: 400 } as DOMRect)
    const height = () => Number(svg.getAttribute('viewBox')!.split(' ')[3])
    return { svg, props, height, events }
  }
  it('pinches proportionally, preserves the center, and resumes panning with the remaining finger', async () => {
    const { svg, height, events } = await mount(), initial = height()
    pointer(svg, 'pointerdown', 1, 100); pointer(svg, 'pointerdown', 2, 200)
    pointer(svg, 'pointermove', 2, 300); await nextTick()
    expect(height()).toBeCloseTo(initial / 2)
    const center = [...events.at(-1)!.center]
    pointer(svg, 'pointermove', 2, 200); await nextTick()
    expect(height()).toBeCloseTo(initial)
    expect(events.at(-1)!.center).toEqual(center)
    pointer(svg, 'pointerup', 2, 200)
    // A delayed lostcapture from the lifted finger must not stop the survivor.
    pointer(svg, 'lostpointercapture', 2, 200)
    pointer(svg, 'pointermove', 1, 140); await nextTick()
    expect(events.at(-1)!.center[0]).toBeCloseTo(center[0]! - initial / 10)
    expect(height()).toBeCloseTo(initial)
  })
  it('clears cancelled gestures and stops interaction when disabled', async () => {
    const { svg, props, height, events } = await mount()
    pointer(svg, 'pointerdown', 1, 100); pointer(svg, 'pointerdown', 2, 200)
    pointer(svg, 'pointercancel', 1, 100); pointer(svg, 'lostpointercapture', 2, 200)
    const count = events.length
    pointer(svg, 'pointermove', 2, 300); expect(events).toHaveLength(count)
    for (const prop of ['active', 'interactive'] as const) {
      pointer(svg, 'pointerdown', 1, 100); pointer(svg, 'pointerdown', 2, 200)
      props[prop] = false; await nextTick()
      const before = height()
      pointer(svg, 'pointermove', 2, 300); await nextTick()
      expect(height()).toBe(before); expect(svg.style.touchAction).toBe('auto')
      props[prop] = true; await nextTick()
      pointer(svg, 'pointermove', 2, 400); await nextTick()
      expect(height()).toBe(before)
    }
  })
  it('handles coincident fingers and clamps extreme pinch distances', async () => {
    const { svg, height } = await mount(), initial = height()
    pointer(svg, 'pointerdown', 1, 100); pointer(svg, 'pointerdown', 2, 100)
    pointer(svg, 'pointermove', 2, 200); await nextTick()
    expect(height()).toBe(initial)
    pointer(svg, 'pointermove', 2, 1000000); await nextTick()
    expect(height()).toBeGreaterThan(0); expect(height()).toBeGreaterThanOrEqual(initial / 32)
    const minimum = height()
    pointer(svg, 'pointermove', 2, 500000); await nextTick()
    expect(height()).toBeCloseTo(minimum * 2)
  })
})
