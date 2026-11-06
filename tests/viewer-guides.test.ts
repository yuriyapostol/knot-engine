// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, createSSRApp, defineComponent, h, nextTick, shallowReactive } from 'vue'
import { renderToString } from 'vue/server-renderer'
import * as THREE from 'three'
import KnotViewer from '../src/components/KnotViewer.vue'
import { guideStep, guideTicks, resolveGuides, type ViewerGuides } from '../src/components/guides'
import { buildSpatialGuides } from '../src/renderer/guides'
import grid from '../v1/examples/knots/grid-diagram.json'
import mosaic from '../v1/examples/knots/mosaic-diagram.json'
import geometry from '../v1/examples/knots/geometry-crossing-demo.json'
import type { RawKnot } from '../src/core'

const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.restoreAllMocks() })
const enabled: ViewerGuides = { grid: { visible: true }, axes: { visible: true } }
async function mount(knot: unknown, extra: Record<string, unknown> = {}) {
  const element = document.createElement('div'); document.body.append(element)
  const props = shallowReactive<Record<string, unknown>>({ knot: knot as RawKnot, label: 'Guides test', ...(knot === geometry ? { representationId: 'crossing-2d' } : {}), ...extra })
  const changes: ViewerGuides[] = []
  const app = createApp(defineComponent({ render: () => h(KnotViewer, { ...props, label: String(props.label), 'onUpdate:guides': (value: ViewerGuides) => changes.push(value) }) }))
  app.mount(element); cleanups.push(() => { app.unmount(); element.remove() }); await nextTick(); await nextTick()
  return { element, props, changes }
}
it('keeps guides hidden by default, localizes controls and isolates local state without mutating props or camera', async () => {
  const guides = { grid: { visible: false } }
  const first = await mount(grid, { guides }), second = await mount(grid, { locale: 'uk' })
  expect(first.element.querySelector('[data-viewer-guides]')).toBeNull()
  expect(resolveGuides()).not.toHaveProperty('bounds')
  expect(resolveGuides().grid.planes).toEqual(['xy'])
  expect(resolveGuides({ grid: { planes: ['xz'] } }).grid.planes).toEqual(['xz'])
  expect(resolveGuides({ grid: { planes: [] } }).grid.planes).toEqual([])
  const viewBox = first.element.querySelector('svg')!.getAttribute('viewBox')
  first.element.querySelector<HTMLButtonElement>('[aria-label="Guides"]')!.click(); await nextTick()
  expect(first.element.textContent).not.toContain('Bounds')
  const checkbox = first.element.querySelector<HTMLInputElement>('input')!
  checkbox.click(); await nextTick()
  expect(first.element.querySelector('pattern')).not.toBeNull()
  expect(second.element.querySelector('pattern')).toBeNull()
  expect(second.element.querySelector('[aria-label="Орієнтири"]')).not.toBeNull()
  expect(guides.grid.visible).toBe(false)
  expect(first.changes.at(-1)?.grid?.visible).toBe(true)
  expect(first.element.querySelector('svg')!.getAttribute('viewBox')).toBe(viewBox)
  first.props.guides = { axes: { visible: true } }; await nextTick()
  expect(first.element.querySelector('pattern')).toBeNull()
  expect(first.element.querySelector('[data-guide-axes]')).not.toBeNull()
  first.props.active = false; await nextTick()
  expect(first.element.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
})
it.each([grid, mosaic, geometry])('uses one open cell path, unique IDs across roots, and closed discrete fields ($id)', async knot => {
  const a = await mount(knot, { guides: enabled }), b = await mount(knot, { guides: enabled })
  const pattern = a.element.querySelector('pattern')!
  expect(pattern.getAttribute('patternUnits')).toBe('userSpaceOnUse')
  expect(pattern.querySelectorAll('path')).toHaveLength(1)
  expect(pattern.querySelector('path')!.getAttribute('d')).toMatch(/^M [\d.e+-]+ 0 H 0 V [\d.e+-]+$/)
  expect(pattern.id).not.toBe(b.element.querySelector('pattern')!.id)
  expect(a.element.querySelector('[data-guide-grid]')!.getAttribute('fill')).toBe(`url(#${pattern.id})`)
  expect(a.element.querySelector('[data-guide-grid-edges]') !== null).toBe(knot !== geometry)
  expect(a.element.querySelector('[data-guide-bounds]')).toBeNull()
  a.props.guides = { axes: { visible: true } }; await nextTick()
  expect(a.element.querySelector('pattern')).toBeNull()
  expect(a.element.querySelector('[data-guide-grid-edges]')).toBeNull()
  expect(a.element.querySelector('[data-guide-axes]')).not.toBeNull()
})
it('places both kinds of indices at cell centers and preserves opposite row orders', async () => {
  for (const [knot, size, firstRow] of [[grid, 5, '4'], [mosaic, 4, '0']] as const) {
    const { element } = await mount(knot, { guides: enabled })
    const unit = size / 500
    expect(element.querySelector('[data-guide-grid-edges]')!.getAttribute('d')).toBe(`M ${size} ${knot === grid ? -size : 0} V ${knot === grid ? 0 : size} H 0`)
    expect(element.querySelector('[data-guide-axis="x"]')!.getAttribute('d')).toBe(`M 0 0 h ${size}`)
    expect(element.querySelector('[data-guide-axis="y"]')!.getAttribute('d')).toBe(`M 0 ${knot === grid ? -size : 0} v ${size}`)
    // Each tick straddles the actual field-edge axis, with no inset axis offset.
    expect(element.querySelector('[data-guide-tick="x"]')!.getAttribute('d')).toBe(`M 0.5 ${-3 * unit} v ${6 * unit}`)
    expect(element.querySelector('[data-guide-tick="y"]')!.getAttribute('d')).toBe(`M ${-3 * unit} ${knot === grid ? -size + 0.5 : 0.5} h ${6 * unit}`)
    const columns = [...element.querySelectorAll('[data-guide-index="column"]')]
    const rows = [...element.querySelectorAll('[data-guide-index="row"]')]
    expect(columns[0]!.getAttribute('x')).toBe('0.5')
    expect(columns[0]!.textContent).toBe('0')
    expect(Number(columns[0]!.getAttribute('y'))).toBeCloseTo((knot === mosaic ? 6 : -6) * unit)
    expect(Number(rows[0]!.getAttribute('x'))).toBeCloseTo(6 * unit)
    expect(rows[0]!.textContent).toBe(firstRow)
    expect(Number(rows[0]!.getAttribute('y'))).toBe(knot === grid ? -size + 0.5 : 0.5)
    expect(rows.at(-1)!.textContent).toBe(knot === grid ? '0' : String(size - 1))
  }
})
it('hydrates visible patterns without mismatches and keeps the paint reference linked', async () => {
  const props = { knot: grid as RawKnot, label: 'SSR grid', guides: enabled }
  const element = document.createElement('div'); element.innerHTML = await renderToString(createSSRApp(KnotViewer, props)); document.body.append(element)
  const warnings = vi.spyOn(console, 'warn'), errors = vi.spyOn(console, 'error')
  const app = createSSRApp(KnotViewer, props); app.mount(element); cleanups.push(() => { app.unmount(); element.remove() })
  await nextTick(); await nextTick()
  expect([...warnings.mock.calls, ...errors.mock.calls].flat().join(' ')).not.toMatch(/hydration|mismatch/i)
  expect(element.querySelector('[data-guide-grid]')!.getAttribute('fill')).toBe(`url(#${element.querySelector('pattern')!.id})`)
})
it('bounds tick work for extreme zoom and chooses useful automatic intervals', () => {
  expect(guideStep(10)).toBe(1); expect(guideStep(30)).toBe(5); expect(guideStep(0.01)).toBe(0.001)
  expect(guideTicks(-100, 100, 1e-6).length).toBeLessThanOrEqual(81)
  expect(guideTicks(2, 1, 1)).toEqual([])
  expect(resolveGuides({ grid: { step: 0 } }).grid.step).toBe('auto')
})
it('builds bounded 3D grid buffers and negative axes without changing model bounds, and releases GPU resources', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-2, -3, -4), new THREE.Vector3(2, 3, 4)), original = bounds.clone()
  const result = buildSpatialGuides(bounds, resolveGuides({ grid: { visible: true, step: 1e-300, planes: ['xy', 'xz', 'yz'] }, axes: { visible: true, labels: false } }), 'dark')
  expect(bounds.equals(original)).toBe(true)
  expect(result.group.children.some(child => child instanceof THREE.Box3Helper)).toBe(false)
  const grids = result.group.children.filter(x => x instanceof THREE.GridHelper)
  expect(grids).toHaveLength(3)
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = []
  result.group.traverse(object => {
    if (!(object instanceof THREE.LineSegments)) return
    expect(object.geometry.attributes.position.count).toBeLessThan(500)
    expect([...object.geometry.attributes.position.array].every(Number.isFinite)).toBe(true)
    geometries.push(object.geometry); materials.push(object.material as THREE.Material)
  })
  const disposed = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'))
  result.dispose()
  expect(result.group.children).toHaveLength(0)
  for (const spy of disposed) expect(spy).toHaveBeenCalledOnce()
})

it('keeps 3D label size readable through zoom and disposes its textures and sprite materials', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillText() {} } as unknown as CanvasRenderingContext2D)
  const result = buildSpatialGuides(new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)), resolveGuides({ axes: { visible: true } }), 'light')
  const labels = result.group.children.filter((item): item is THREE.Sprite => item instanceof THREE.Sprite)
  expect(labels.length).toBeGreaterThan(3)
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2); camera.position.set(0, 0, 10)
  result.update(camera, 500)
  expect(labels[0]!.scale.y).toBeCloseTo(26 * 4 / 500)
  camera.zoom = 2; result.update(camera, 500)
  expect(labels[0]!.scale.y).toBeCloseTo(26 * 2 / 500)
  const perspective = new THREE.PerspectiveCamera(60, 1, 0.01, 100); perspective.position.set(0, 0, 10)
  result.update(perspective, 500)
  const nearScale = labels[0]!.scale.y
  perspective.position.z = 20; result.update(perspective, 500)
  expect(labels[0]!.scale.y).toBeCloseTo(nearScale * 2)
  const textures = labels.map(sprite => vi.spyOn(sprite.material.map!, 'dispose'))
  const materials = labels.map(sprite => vi.spyOn(sprite.material, 'dispose'))
  result.dispose()
  for (const spy of [...textures, ...materials]) expect(spy).toHaveBeenCalledOnce()
})
