// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { KnotViewer, type KnotAsset } from '../src'
import open from '../v1/spec/examples/assets/open-rope.json'

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

it.each([
  { asset: open as unknown as KnotAsset, label: 'Hydration model' }
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
  expect(document.querySelector('.knot-viewer-v1')?.getAttribute('aria-label')).toBe('Hydration model')
  expect(document.querySelector('.knot-viewer-v1__surface')).not.toBeNull()
  expect(document.querySelector('.knot-viewer-v1__fallback')).not.toBeNull()
  expect(document.querySelector('.knot-viewer')).toBeNull()
  app.unmount()
})
