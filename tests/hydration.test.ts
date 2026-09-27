// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { KnotViewer, type KnotModelV1 } from '../src'
import loop from '../examples/models/prototype-loop.json'

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

it('hydrates the server fallback without a mismatch before WebGL initialization', async () => {
  const props = { model: loop as KnotModelV1, label: 'Hydration model' }
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
  expect(document.querySelector('.knot-viewer')?.getAttribute('aria-label')).toBe('Hydration model')
  app.unmount()
})
