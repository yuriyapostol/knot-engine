// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, shallowReactive } from 'vue'
import KnotViewer from '../src/components/KnotViewer.vue'
import loop from '../v1/examples/knots/twisted-loop.json'
import { applyStepData, GEOMETRY_3D, type Camera3D, type RawKnot, type ViewDefinition, type Geometry3DData } from '../src/core'

const calls = vi.hoisted(() => ({ setModel: vi.fn(), view: vi.fn() }))
vi.mock('../src/renderer/ViewerEngine', () => ({
  ViewerEngine: class {
    onReady?: (warnings: string[]) => void
    view = calls.view
    setModel(...args: unknown[]) { calls.setModel(...args); this.onReady?.([]) }
    clear() {}
    dispose() {}
    resize() {}
    setActive() {}
    setInteractive() {}
    setTheme() {}
    setVisible() {}
  },
}))
const camera: Camera3D = { mode: 'fixed', position: [0.1, 0.2, 0.4], target: [0, 0, 0], up: [0, 1, 0], projection: { kind: 'perspective', fovY: 1 } }
const mounts: Array<() => void> = []
const flush = async () => { await nextTick(); await nextTick(); await nextTick() }
async function mount(preserveCamera = false) {
  const props = shallowReactive({
    knot: structuredClone(loop) as RawKnot | null,
    label: 'Loop', representationId: 'view-3d-finish', preserveCamera,
    initialCamera: undefined as Camera3D | undefined,
    view: undefined as ViewDefinition | undefined,
    quality: 'medium' as 'medium' | 'high',
  })
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(defineComponent({ render: () => h(KnotViewer, props) }))
  app.mount(root)
  mounts.push(() => { app.unmount(); root.remove() })
  await flush()
  return props
}
beforeEach(() => {
  calls.setModel.mockClear()
  calls.view.mockReset().mockReturnValue(camera)
  class Observer { observe() {} disconnect() {} }
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
})
afterEach(() => { mounts.splice(0).forEach(unmount => unmount()); vi.unstubAllGlobals() })

it('keeps refitting representations by default', async () => {
  const props = await mount()
  props.knot = { ...props.knot!, representations: props.knot!.representations!.map(rep => rep.id === 'view-3d-finish' ? { ...rep, data: { ...(rep.data as object) } } : rep) }
  await flush()
  expect(calls.setModel).toHaveBeenCalledTimes(2)
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
  expect(calls.view).not.toHaveBeenCalled()
})
it('preserves the current camera across steps and quality changes through KnotViewer', async () => {
  const props = await mount(true)
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
  const base = loop.representations.find(rep => rep.id === 'view-3d-finish')!
  for (const step of loop.procedures![0].steps) {
    const result = step.data ? applyStepData(base.data as Geometry3DData, step.data as Parameters<typeof applyStepData>[1], GEOMETRY_3D) : { valid: true as const, data: base.data }
    expect(result.valid).toBe(true)
    if (!result.valid) continue
    props.knot = { ...props.knot!, representations: props.knot!.representations!.map(rep => rep.id === base.id ? { ...rep, data: result.data } : rep) }
    await flush()
    expect(calls.setModel.mock.lastCall?.[3]).toEqual(camera)
  }
  props.quality = 'high'
  await flush()
  expect(calls.setModel.mock.lastCall?.[3]).toEqual(camera)
})
it('resets preservation for a different knot or explicit camera/view', async () => {
  const props = await mount(true)
  props.knot = { ...(structuredClone(loop) as RawKnot), id: 'another-knot' }
  await flush()
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
  props.initialCamera = camera
  await flush()
  expect(calls.setModel.mock.lastCall?.[2]).toEqual(camera)
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
  props.view = { id: 'new-view', name: 'New view', space: 'space', camera }
  await flush()
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
})
it('does not reuse a stale camera after empty or invalid input', async () => {
  const props = await mount(true)
  const knot = props.knot
  props.knot = null
  await flush()
  props.knot = knot
  await flush()
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
  props.representationId = 'missing'
  await flush()
  props.representationId = 'view-3d-finish'
  await flush()
  // Dispatch failures unmount the 3D viewer, so recovery must start fresh.
  expect(calls.setModel.mock.lastCall?.[3]).toBeUndefined()
})
