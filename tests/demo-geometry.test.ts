// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import InteractiveExample from '../site/components/InteractiveExample.vue'
import crossing from '../v1/examples/knots/geometry-crossing-demo.json'
import loop from '../v1/examples/knots/twisted-loop.json'
import type { Geometry2DData, RawKnot } from '../src/core'

const viewer = vi.hoisted(() => ({ capture: vi.fn(), props: null as null | { knot: RawKnot; representationId: string } }))
vi.mock('knot-engine', async () => {
  const core = await import('../src/core')
  const { defineComponent, h } = await import('vue')
  return {
    ...core,
    KnotViewer: defineComponent({
      props: ['knot', 'representationId'],
      setup(props, { expose }) {
        expose({ capture: viewer.capture })
        return () => {
          viewer.props = props as unknown as NonNullable<typeof viewer.props>
          return h('div', { 'data-viewer': props.representationId })
        }
      },
    }),
  }
})

let unmount: (() => void) | undefined
afterEach(() => {
  unmount?.()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('selects the closed trefoil as another representation of the existing overhand example', async () => {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(InteractiveExample)
  app.mount(root)
  unmount = () => { app.unmount(); root.remove() }
  const models = root.querySelector<HTMLSelectElement>('.knot-engine-v1-demo__model-select select')!
  expect(Array.from(models.options, option => option.value)).toEqual(['overhand', 'loop'])
  const representation = root.querySelector<HTMLSelectElement>('.knot-engine-v1-demo__representation-select')!
  representation.value = 'view-2d-closed'
  representation.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(viewer.props!.knot.id).toBe('overhand')
  expect(viewer.props!.representationId).toBe('view-2d-closed')
  expect(JSON.parse(root.querySelector('textarea')!.value).id).toBe('overhand')
  expect(root.querySelector('[role="alert"]')).toBeNull()
})

it('imports 2D/3D geometry, applies 2D steps and exports the selected format', async () => {
  vi.useFakeTimers()
  viewer.capture.mockReset().mockResolvedValue(new Blob(['image']))
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:demo'), revokeObjectURL: vi.fn() })
  const downloads: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download) })
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(InteractiveExample)
  app.mount(root)
  unmount = () => { app.unmount(); root.remove() }
  const editor = root.querySelector('textarea')!
  editor.value = JSON.stringify(crossing)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(300)
  await nextTick()

  const representation = root.querySelector<HTMLSelectElement>('.knot-engine-v1-demo__representation-select')!
  expect(Array.from(representation.options, option => option.value)).toEqual(['crossing-2d', 'crossing-3d'])
  expect(representation.value).toBe('crossing-2d')
  const geometry = () => viewer.props!.knot.representations!.find(rep => rep.id === 'crossing-2d')!.data as Geometry2DData
  expect(geometry()).toEqual(crossing.representations[0].data)
  const step = Array.from(root.querySelectorAll('select')).find(select => Array.from(select.options).some(option => option.value === 'before'))!
  expect(step.value).toBe('after')
  step.value = 'before'
  step.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(geometry().crossings).toEqual([])
  expect(geometry().elements.find(element => element.id === 'rope-b')).toMatchObject({ points: [[0, 2.5], [2, 2.5]] })

  step.value = 'after'
  step.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(geometry()).toEqual(crossing.representations[0].data)
  expect(root.querySelector('[role="alert"]')).toBeNull()

  const exportButton = root.querySelector<HTMLButtonElement>('.knot-engine-v1-demo__stage > .knot-engine-v1-demo__actions button')!
  exportButton.click()
  await nextTick()
  expect(viewer.capture).toHaveBeenLastCalledWith({ view: 'current', format: 'image/svg+xml' })
  expect(downloads.at(-1)).toBe('knot-current.svg')

  const pngButton = root.querySelector<HTMLButtonElement>('.knot-engine-v1-demo__stage > .knot-engine-v1-demo__actions button:nth-child(2)')!
  pngButton.click()
  await nextTick()
  expect(viewer.capture).toHaveBeenLastCalledWith({ view: 'current', format: 'image/png' })
  expect(downloads.at(-1)).toBe('knot-current.png')

  representation.value = 'crossing-3d'
  representation.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(viewer.props!.representationId).toBe('crossing-3d')
  exportButton.click()
  await nextTick()
  expect(viewer.capture).toHaveBeenLastCalledWith({ view: 'current', format: 'image/png' })
  expect(downloads.at(-1)).toBe('knot-current.png')
})

it('filters algorithms and steps by representation type and keeps step selection within that type', async () => {
  vi.useFakeTimers()
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(InteractiveExample)
  app.mount(root)
  unmount = () => { app.unmount(); root.remove() }
  const model: RawKnot = JSON.parse(JSON.stringify(crossing))
  model.representations!.push({ ...model.representations![1], id: 'other-3d' })
  model.algorithms!.push({ id: 'mixed', steps: [
    { id: 'only-3d', representations: [{ id: 'crossing-3d' }] },
    { id: 'both', representations: [{ id: 'crossing-3d' }, { id: 'crossing-2d' }] },
    { id: 'only-2d', representations: [{ id: 'crossing-2d' }] },
  ] })
  const editor = root.querySelector('textarea')!
  editor.value = JSON.stringify(model)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(300)
  await nextTick()

  const settings = () => Array.from(root.querySelectorAll<HTMLSelectElement>('.knot-engine-v1-demo__view-settings select'))
  const values = (select: HTMLSelectElement) => Array.from(select.options, option => option.value)
  const change = async (select: HTMLSelectElement, value: string) => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
  }
  expect(values(settings()[1])).toEqual(['crossing-steps', 'mixed'])
  expect(values(settings()[2])).toEqual(['before', 'after'])
  await change(settings()[1], 'mixed')
  expect(values(settings()[2])).toEqual(['both', 'only-2d'])
  expect(viewer.props!.representationId).toBe('crossing-2d')

  await change(settings()[0], 'other-3d')
  expect(settings()).toHaveLength(2)
  expect(values(settings()[1])).toEqual(['only-3d', 'both'])
  expect(viewer.props!.representationId).toBe('other-3d')
  await change(settings()[1], 'both')
  expect(viewer.props!.representationId).toBe('crossing-3d')
  expect(viewer.props!.knot.representations![0].data).toEqual(crossing.representations[0].data)

  await change(settings()[0], 'crossing-2d')
  expect(values(settings()[1])).toEqual(['crossing-steps', 'mixed'])
  expect(values(settings()[2])).toEqual(['before', 'after'])
  expect(settings()[2].value).toBe('after')
  expect(root.querySelector('[role="alert"]')).toBeNull()

  const modelSelect = root.querySelector<HTMLSelectElement>('.knot-engine-v1-demo__model-select select')!
  await change(modelSelect, 'loop')
  await change(settings()[0], 'mosaic-loop')
  expect(settings()).toHaveLength(1)
  await change(settings()[0], 'view-3d-finish')
  expect(settings()).toHaveLength(3)
})

it('opens the base state when switching algorithms, including reversed steps and multiple illustrations', async () => {
  vi.useFakeTimers()
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(InteractiveExample)
  app.mount(root)
  unmount = () => { app.unmount(); root.remove() }
  const settings = () => Array.from(root.querySelectorAll<HTMLSelectElement>('.knot-engine-v1-demo__view-settings select'))
  const change = async (select: HTMLSelectElement, value: string) => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
  }
  await change(root.querySelector<HTMLSelectElement>('.knot-engine-v1-demo__model-select select')!, 'loop')
  const base = loop.representations.find(rep => rep.id === 'view-3d-finish')!
  const displayedGeometry = () => viewer.props!.knot.representations!.find(rep => rep.id === viewer.props!.representationId)!.data
  expect(settings()[2].value).toBe('finish')
  expect(displayedGeometry()).toEqual(base.data)
  await change(settings()[0], 'mosaic-loop')
  await change(settings()[0], 'view-3d-finish')
  expect(settings()[2].value).toBe('finish')
  expect(displayedGeometry()).toEqual(base.data)
  await change(settings()[1], 'sequence-b')
  expect(settings()[2].value).toBe('finish')
  expect(displayedGeometry()).toEqual(base.data)
  await change(settings()[2], 'rest')
  expect(displayedGeometry()).not.toEqual(base.data)
  await change(settings()[1], 'sequence-a')
  expect(settings()[2].value).toBe('finish')
  expect(displayedGeometry()).toEqual(base.data)

  const model: RawKnot = JSON.parse(JSON.stringify(crossing))
  model.representations!.push({ ...model.representations![1], id: 'other-3d' })
  model.algorithms = [
    { id: 'references', base: { id: 'other-3d' }, steps: [
      { id: 'different', representations: [{ id: 'crossing-3d' }] },
      { id: 'base', data: {}, representations: [{ id: 'crossing-3d' }, { id: 'other-3d' }] },
    ] },
    { id: 'without-base', steps: [{ id: 'first', representations: [{ id: 'crossing-3d' }] }] },
    { id: 'without-base-step', base: { id: 'other-3d' }, steps: [{ id: 'different', representations: [{ id: 'crossing-3d' }] }] },
  ]
  const editor = root.querySelector('textarea')!
  editor.value = JSON.stringify(model)
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(300)
  await nextTick()
  await change(settings()[0], 'crossing-3d')
  expect(settings()[2].value).toBe('different')
  expect(viewer.props!.representationId).toBe('crossing-3d')
  await change(settings()[0], 'other-3d')
  expect(settings()[2].value).toBe('base')
  expect(viewer.props!.representationId).toBe('other-3d')
  await change(settings()[1], 'without-base')
  expect(settings()[2].value).toBe('first')
  expect(viewer.props!.representationId).toBe('crossing-3d')
  await change(settings()[1], 'references')
  expect(settings()[2].value).toBe('base')
  expect(viewer.props!.representationId).toBe('other-3d')
  await change(settings()[1], 'without-base-step')
  expect(settings()[2].value).toBe('different')
  expect(viewer.props!.representationId).toBe('crossing-3d')
  expect(root.querySelector('[role="alert"]')).toBeNull()
})
