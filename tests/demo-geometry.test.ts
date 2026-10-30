// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import InteractiveExample from '../site/components/InteractiveExample.vue'
import crossing from '../v1/examples/knots/geometry-crossing-demo.json'
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
  expect(geometry().crossings).toEqual([])
  expect(geometry().elements.find(element => element.id === 'rope-b')!.points).toEqual([[0, 2], [2, 2]])

  const step = Array.from(root.querySelectorAll('select')).find(select => Array.from(select.options).some(option => option.value === 'before'))!
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

  representation.value = 'crossing-3d'
  representation.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(viewer.props!.representationId).toBe('crossing-3d')
  exportButton.click()
  await nextTick()
  expect(viewer.capture).toHaveBeenLastCalledWith({ view: 'current', format: 'image/png' })
  expect(downloads.at(-1)).toBe('knot-current.png')
})
