// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, shallowReactive, type Component } from 'vue'
import Knot2DViewer from '../src/components/Knot2DViewer.vue'
import KnotViewer from '../src/components/KnotViewer.vue'
import example from '../v1/examples/knots/geometry-crossing-demo.json'
import bezier from '../v1/examples/knots/bezier-2d.json'
import type { CaptureOptions, Geometry2DView, RawKnot, ViewDefinition } from '../src'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.restoreAllMocks() })
const preset: ViewDefinition = { id: 'detail', name: 'Detail', space: 'plane', camera: { mode: 'plane', center: [2, 3], height: 4 } }
async function mount(extra: Record<string, unknown> = {}, generic = false) {
  const props = shallowReactive<Record<string, unknown>>({ knot: structuredClone(example) as RawKnot | null, representationId: 'crossing-2d', label: '2D knot', locale: 'en', ...extra })
  const exposed = ref<{ resetView(): void; fitToView(): void; capture(options?: CaptureOptions): Promise<Blob> }>()
  const events: Geometry2DView[] = [], errors: string[] = []
  let ready = 0
  const root = document.createElement('div'); document.body.append(root)
  const app = createApp(defineComponent({ render: () => h((generic ? KnotViewer : Knot2DViewer) as Component, {
    ...props, ref: exposed, onReady: () => ready++, onError: (e: { message: string }) => errors.push(e.message),
    'onView-change': (view: Geometry2DView) => events.push(view),
  }) }))
  app.mount(root); cleanups.push(() => { app.unmount(); root.remove() }); await nextTick()
  return { root, props, exposed, events, errors, get ready() { return ready } }
}
function read(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob)
  })
}
function pointer(root: Element, type: string, x: number, y: number, id = 1) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0 }); root.dispatchEvent(event)
}

it('renders real SVG standalone and through the compositor, with immutable input and forwarded events', async () => {
  for (const generic of [false, true]) {
    const knot = structuredClone(example), before = JSON.stringify(knot)
    const mounted = await mount({ knot }, generic)
    expect(mounted.ready).toBeGreaterThan(0)
    expect(mounted.root.querySelector('[data-state="ready"]')).not.toBeNull()
    expect(mounted.root.querySelectorAll('svg use').length).toBeGreaterThan(1)
    expect(mounted.root.querySelector('canvas')).toBeNull()
    mounted.root.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click(); await nextTick()
    expect(mounted.events).toHaveLength(1)
    expect(JSON.stringify(knot)).toBe(before)
  }
})

it('resolves plane presets, distinguishes reset from fit, and exports preview independently of live camera', async () => {
  const mounted = await mount({ view: { id: 'detail' }, views: [preset] })
  const svg = mounted.root.querySelector('svg')!
  expect(svg.getAttribute('viewBox')).toBe('0 -5 4 4')
  svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, cancelable: true })); await nextTick()
  const changed = svg.getAttribute('viewBox')
  expect(changed).not.toBe('0 -5 4 4')
  const current = await read(await mounted.exposed.value!.capture({ width: 320, height: 180, view: 'current' }))
  const preview = await read(await mounted.exposed.value!.capture({ view: 'model-preview' }))
  expect(current).toContain(`viewBox="${changed}"`)
  expect(current).toContain('width="320"'); expect(current).toContain('height="180"')
  expect(preview).toContain('viewBox="0 -5 4 4"')
  expect(svg.getAttribute('viewBox')).toBe(changed)
  mounted.exposed.value!.fitToView(); await nextTick()
  expect(svg.getAttribute('viewBox')).not.toBe('0 -5 4 4')
  mounted.exposed.value!.resetView(); await nextTick()
  expect(svg.getAttribute('viewBox')).toBe('0 -5 4 4')
  mounted.props.view = { ...preset, camera: { mode: 'plane', center: [0, 0], height: 2 } }
  await nextTick(); expect(svg.getAttribute('viewBox')).toBe('-1 -1 2 2')
})

it('pans using the shorter viewport dimension, supports keyboard, and stops inactive interactions', async () => {
  const mounted = await mount({ view: preset })
  const svg = mounted.root.querySelector('svg')!
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ width: 800, height: 400 } as DOMRect)
  pointer(svg, 'pointerdown', 0, 0); pointer(svg, 'pointermove', 100, 50); pointer(svg, 'pointerup', 100, 50)
  await nextTick(); expect(mounted.events.at(-1)).toEqual({ center: [1, 3.5], height: 4 })
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await nextTick()
  expect(mounted.events.at(-1)!.center[1]).toBeCloseTo(3.9)
  mounted.props.active = false; await nextTick()
  const before = svg.getAttribute('viewBox'), count = mounted.events.length
  svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 })); svg.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }))
  pointer(svg, 'pointerdown', 0, 0); pointer(svg, 'pointermove', 50, 50); await nextTick()
  expect(svg.getAttribute('viewBox')).toBe(before); expect(mounted.events).toHaveLength(count)
  expect(mounted.root.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true)
  mounted.props.active = true; mounted.props.interactive = false; await nextTick()
  expect(mounted.root.querySelector('button')).toBeNull()
  expect(svg.hasAttribute('tabindex')).toBe(false)
})

it('rejects invalid/spatial views and recovers after changing the view or representation', async () => {
  const mounted = await mount({ view: { id: 'missing' } }, true)
  expect(mounted.errors.at(-1)).toMatch(/Unknown local view/)
  expect(mounted.root.querySelector('[role="alert"]')).not.toBeNull()
  mounted.props.view = { id: 'spatial', name: 'Spatial', space: 'space', camera: { mode: 'fit', direction: [0, 0, 1], up: [0, 1, 0], projection: { kind: 'orthographic' } } }
  await nextTick(); expect(mounted.errors.at(-1)).toMatch(/plane view/)
  mounted.props.view = preset; await nextTick()
  expect(mounted.root.querySelector('svg')).not.toBeNull()
  mounted.props.representationId = 'missing'; await nextTick()
  expect(mounted.root.querySelector('[data-state="error"]')).not.toBeNull()
  mounted.props.representationId = 'crossing-2d'; await nextTick()
  expect(mounted.root.querySelector('[data-state="ready"]')).not.toBeNull()
})

it('exports self-contained color, transparent crossing gaps and optional opaque background', async () => {
  const mounted = await mount()
  const svg = mounted.root.querySelector('svg')!, host = svg.parentElement!
  svg.style.color = 'rgb(12, 34, 56)'; host.style.backgroundColor = 'rgb(90, 80, 70)'
  const content = await read(await mounted.exposed.value!.capture())
  const parsed = new DOMParser().parseFromString(content, 'image/svg+xml')
  expect(parsed.querySelector('parsererror')).toBeNull()
  expect(parsed.documentElement.style.color).toBe('rgb(12, 34, 56)')
  expect(parsed.querySelector('mask use[stroke="black"]')).not.toBeNull()
  const paths = parsed.querySelectorAll('defs > path')
  expect(paths).toHaveLength(2)
  const masking = parsed.querySelector('mask use')!, overlay = parsed.querySelector('svg > g > use')!
  expect(masking.getAttribute('href')).toBe(overlay.getAttribute('href'))
  const width = Number(overlay.parentElement!.getAttribute('stroke-width'))
  const maskDash = Number(masking.getAttribute('stroke-dasharray')!.split(' ')[0])
  const overDash = Number(overlay.getAttribute('stroke-dasharray')!.split(' ')[0])
  expect(overDash - maskDash).toBeCloseTo(width)
  expect(Number(masking.getAttribute('stroke-dashoffset'))).toBeCloseTo(Number(overlay.getAttribute('stroke-dashoffset')) - width / 2)
  expect(parsed.querySelector('g[mask] > use')!.hasAttribute('stroke-dasharray')).toBe(true)
  expect(parsed.documentElement.querySelector(':scope > rect')).toBeNull()
  const opaque = await read(await mounted.exposed.value!.capture({ transparent: false }))
  expect(opaque).toContain('fill="rgb(90, 80, 70)"')
  for (const options of [{ width: 0 }, { height: 2049 }, { width: 2.5 }, { format: 'image/jpeg' }, { view: 'bad' }]) {
    await expect(mounted.exposed.value!.capture(options as CaptureOptions)).rejects.toThrow(/Invalid/)
  }
  mounted.props.knot = null; await nextTick()
  await expect(mounted.exposed.value!.capture()).rejects.toThrow(/not ready/)
})

it('uses distinct crossing masks for simultaneous viewers and renders Catmull–Rom paths', async () => {
  const knot = structuredClone(example) as RawKnot
  const data = knot.representations![0].data as { elements: { interpolation: unknown }[] }
  data.elements[0].interpolation = { type: 'catmull-rom', parameterization: 'centripetal' }
  const first = await mount({ knot }), second = await mount({ knot })
  expect(first.root.querySelector('defs > path')!.getAttribute('d')).toContain('C ')
  expect(first.root.querySelector('mask')!.id).not.toBe(second.root.querySelector('mask')!.id)
})

it('renders and captures mixed Bezier paths and one-segment closed loops through either viewer', async () => {
  for (const generic of [false, true]) {
    const knot = structuredClone(bezier), before = JSON.stringify(knot)
    const mounted = await mount({ knot, representationId: 'bezier-2d' }, generic)
    expect(mounted.errors).toEqual([])
    expect(mounted.ready).toBeGreaterThan(0)
    const paths = mounted.root.querySelectorAll('defs > path')
    expect(paths).toHaveLength(3)
    expect(paths[0].getAttribute('d')).toMatch(/Q .*C .*L /)
    expect(paths[2].getAttribute('d')).toMatch(/C .* Z$/)
    expect(mounted.root.querySelector('mask use')).not.toBeNull()
    const content = await read(await mounted.exposed.value!.capture())
    const parsed = new DOMParser().parseFromString(content, 'image/svg+xml')
    expect(parsed.querySelector('parsererror')).toBeNull()
    expect(parsed.querySelector('defs > path')!.getAttribute('d')).toContain('Q ')
    expect(JSON.stringify(knot)).toBe(before)
  }
})

it('renders a PD-only knot through the 2D viewer without modifying the input', async () => {
  const knot: RawKnot = {
    schema: 'Knot', schemaVersion: 1,
    namespaces: { 'knot-engine': 'https://yuriyapostol.github.io/knot-engine/v1/' },
    id: 'pd-trefoil', subject: { id: 'pd-trefoil-subject' },
    representations: [{
      id: 'pd', type: 'pd-code',
      data: { convention: 'pd-ccw-under-first', crossings: [[1,5,2,4],[3,1,4,6],[5,3,6,2]] },
    }],
  }
  const before = JSON.stringify(knot)
  const mounted = await mount({ knot, representationId: 'pd' })
  expect(mounted.errors).toEqual([])
  expect(mounted.ready).toBeGreaterThan(0)
  expect(mounted.root.querySelector('[data-state="ready"]')).not.toBeNull()
  expect(mounted.root.querySelector('svg')).not.toBeNull()
  const generic = await mount({ knot, representationId: 'pd' }, true)
  expect(generic.errors).toEqual([])
  expect(generic.root.querySelector('[data-state="ready"]')).not.toBeNull()
  expect(JSON.stringify(knot)).toBe(before)
})
