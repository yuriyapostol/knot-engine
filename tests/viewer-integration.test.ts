// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import KnotViewer from '../src/components/KnotViewer.vue'
import KnotMosaicViewer from '../src/components/KnotMosaicViewer.vue'
import open from '../v1/examples/assets/open-rope.json'
import mosaic from '../v1/examples/assets/mosaic-diagram.json'
import { LOMONACO_KAUFFMAN_11, type RawAsset } from '../src/core'

const spatial = () => structuredClone(open) as unknown as RawAsset
const diagram = () => {
  const asset = structuredClone(mosaic) as unknown as RawAsset
  ;(asset.representations![0].data as { tileSet: string }).tileSet = LOMONACO_KAUFFMAN_11
  return asset
}
const containers: Array<{ app: ReturnType<typeof createApp>; element: HTMLElement }> = []
function mount(component: Parameters<typeof h>[0], props: Record<string, unknown>) {
  const element = document.createElement('div')
  document.body.append(element)
  const app = createApp(defineComponent({ render: () => h(component, props) }))
  app.mount(element)
  containers.push({ app, element })
  return element
}
afterEach(() => {
  for (const { app, element } of containers.splice(0)) { app.unmount(); element.remove() }
})
describe('viewer integration', () => {
  it('renders a mosaic standalone and exposes its SVG paths without WebGL', async () => {
    const element = mount(KnotMosaicViewer, { asset: diagram(), label: 'Mosaic' })
    await nextTick()
    expect(element.querySelector('[data-state="ready"]')).not.toBeNull()
    expect(element.querySelectorAll('svg path').length).toBeGreaterThan(0)
    expect(element.querySelector('canvas')).toBeNull()
  })
  it('captures SVG with requested dimensions and rejects unsupported formats', async () => {
    const exposed = ref<{ capture: (options?: { width?: number; height?: number; format?: string; view?: string }) => Promise<Blob> } | null>(null)
    const element = document.createElement('div')
    document.body.append(element)
    const app = createApp(defineComponent({ render: () => h(KnotMosaicViewer, { ref: exposed, asset: diagram(), label: 'Mosaic' }) }))
    app.mount(element)
    containers.push({ app, element })
    await nextTick()
    const blob = await exposed.value!.capture({ width: 320, height: 180, view: 'model-preview' })
    expect(blob.type).toBe('image/svg+xml')
    const svg = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob) })
    expect(svg).toContain('width="320"')
    expect(svg).toContain('height="180"')
    expect(svg).toContain('viewBox="0 0 4 4"')
    await expect(exposed.value!.capture({ format: 'image/png' })).rejects.toThrow()
    await expect(exposed.value!.capture({ view: 'unsupported' })).rejects.toThrow()
    await expect(exposed.value!.capture({ width: 0 })).rejects.toThrow()
  })
  it('dispatches a mosaic and forwards ready and view-change events', async () => {
    const events: string[] = []
    const element = mount(KnotViewer, {
      asset: diagram(), label: 'Mosaic',
      onReady: () => events.push('ready'),
      'onView-change': () => events.push('view-change'),
    })
    await nextTick()
    expect(element.querySelector('svg.knot-engine-v1-mosaic')).not.toBeNull()
    expect(events).toContain('ready')
    ;(element.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement).click()
    await nextTick()
    expect(events).toContain('view-change')
  })
  it('reports dispatch errors and recovers when the selected representation changes', async () => {
    const asset = diagram()
    const selectedId = ref('missing')
    const errors: string[] = []
    const element = document.createElement('div')
    document.body.append(element)
    const app = createApp(defineComponent({ render: () => h(KnotViewer, {
      asset, label: 'Mosaic', representationId: selectedId.value,
      onError: (event: { code: string }) => errors.push(event.code),
    }) }))
    app.mount(element)
    containers.push({ app, element })
    await nextTick()
    expect(element.querySelector('[data-state="error"]')).not.toBeNull()
    expect(errors).toContain('REPRESENTATION_NOT_FOUND')
    selectedId.value = 'mosaic'
    await nextTick()
    expect(element.querySelector('svg.knot-engine-v1-mosaic')).not.toBeNull()
    expect(element.querySelector('[data-state="ready"]')).not.toBeNull()
  })
  it('keeps the selected 3D viewer in its SSR-safe empty state without an asset', async () => {
    const element = mount(KnotViewer, { label: 'Empty' })
    await nextTick()
    expect(element.querySelector('[data-state="empty"]')).not.toBeNull()
  })
  it('does not mutate the input mosaic during rendering and interaction', async () => {
    const asset = diagram()
    const before = JSON.stringify(asset)
    const element = mount(KnotMosaicViewer, { asset, label: 'Mosaic' })
    await nextTick()
    ;(element.querySelector('[aria-label="Zoom in"]') as HTMLButtonElement).click()
    await nextTick()
    expect(JSON.stringify(asset)).toBe(before)
  })
})
