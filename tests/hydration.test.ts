// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { Knot2DViewer, KnotViewer, type RawKnot } from '../src'
import open from '../v1/examples/knots/open-rope.json'
import crossing from '../v1/examples/knots/geometry-crossing-demo.json'

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

it.each([
  { knot: open as unknown as RawKnot, label: 'Hydration model' }
])('hydrates the server fallback without a mismatch before WebGL initialization (%j)', async props => {
  const serverHtml = await renderToString(createSSRApp(KnotViewer, props))
  document.body.innerHTML = `<div id="app">${serverHtml}</div>`
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = createSSRApp(KnotViewer, props)
  app.mount('#app')
  await nextTick()
  await nextTick()
  expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/hydration|mismatch/i)
  expect(document.querySelector('.knot-engine-v1-viewer')?.getAttribute('aria-label')).toBe('Hydration model')
  expect(document.querySelector('.knot-engine-v1-viewer__surface')).not.toBeNull()
  expect(document.querySelector('.knot-engine-v1-viewer__fallback')).not.toBeNull()
  expect(document.querySelector('.knot-viewer, .knot-viewer-v1')).toBeNull()
  app.unmount()
})

it('hydrates the 2D SVG and keeps its crossing mask linked after mounting', async () => {
  const props = { knot: crossing as RawKnot, label: '2D hydration' }
  const serverHtml = await renderToString(createSSRApp(Knot2DViewer, props))
  document.body.innerHTML = `<div id="app">${serverHtml}</div>`
  const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = createSSRApp(Knot2DViewer, props)
  try {
    app.mount('#app'); await nextTick(); await nextTick()
    expect([...warnings.mock.calls, ...errors.mock.calls].flat().join(' ')).not.toMatch(/hydration|mismatch/i)
    const svg = document.querySelector('svg')!
    expect(svg.querySelector('g[mask]')!.getAttribute('mask')).toBe(`url(#${svg.querySelector('mask')!.id})`)
    expect(document.querySelector('[data-state="ready"]')).not.toBeNull()
  } finally { app.unmount() }
})
