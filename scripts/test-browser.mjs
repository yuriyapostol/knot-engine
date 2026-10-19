import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const fixture = path => JSON.parse(readFileSync(path, 'utf8'))
const server = await createServer({ configFile: resolve('site/runtime/vite.config.ts'), server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
  // Probe future-generation namespace isolation with representative CSS, not a v2 runtime.
  const styles = await browser.newPage()
  const v1CSS = readFileSync('src/styles.css', 'utf8')
  const v2CSS = `.knot-viewer-v2{background:var(--knot-viewer-v2-background,rgb(40,50,60));border-radius:3px}.knot-viewer-v2__canvas{position:relative}`
  for (const sheets of [[v1CSS, v2CSS], [v2CSS, v1CSS]]) {
    await styles.setContent(`<section id="host" style="--knot-viewer-v1-background:rgb(1,2,3);--knot-viewer-v1-radius:20px;--knot-viewer-v1-aspect-ratio:1;--knot-viewer-v1-toolbar-gap:9px">
      <div id="light" class="knot-viewer-v1" data-theme="light" data-state="ready">
        <canvas class="knot-viewer-v1__canvas"></canvas>
        <div class="knot-viewer-v1__toolbar"><button>Reset</button></div>
      </div>
      <div id="dark" class="knot-viewer-v1" data-theme="dark" data-state="error">
        <canvas class="knot-viewer-v1__canvas"></canvas>
        <div class="knot-viewer-v1__fallback" role="alert">Error</div>
      </div>
      <div id="local" class="knot-viewer-v1" data-theme="dark" style="--knot-viewer-v1-background:rgb(4,5,6)"></div>
      <div id="future" class="knot-viewer-v2"><canvas class="knot-viewer-v2__canvas"></canvas></div>
    </section>
    <div id="default-light" class="knot-viewer-v1" data-theme="light"></div>
    <div id="default-dark" class="knot-viewer-v1" data-theme="dark"></div>`)
    for (const content of sheets) await styles.addStyleTag({ content })
    const computed = () => styles.evaluate(() => {
      const css = selector => getComputedStyle(document.querySelector(selector))
      return {
        light: css('#light').backgroundColor, dark: css('#dark').backgroundColor,
        local: css('#local').backgroundColor, radius: css('#light').borderRadius,
        aspect: css('#light').aspectRatio, gap: css('#light .knot-viewer-v1__toolbar').gap,
        button: css('#light button').minHeight, canvas: css('#light canvas').position,
        ready: css('#light canvas').visibility, error: css('#dark canvas').visibility,
        alert: css('#dark .knot-viewer-v1__fallback').color,
        future: css('#future').backgroundColor, futureRadius: css('#future').borderRadius,
        futureCanvas: css('#future canvas').position,
        defaultLight: css('#default-light').backgroundColor, defaultDark: css('#default-dark').backgroundColor
      }
    })
    const expected = {
      light: 'rgb(1, 2, 3)', dark: 'rgb(1, 2, 3)', local: 'rgb(4, 5, 6)',
      radius: '20px', aspect: '1 / 1', gap: '9px', button: '44px', canvas: 'absolute',
      ready: 'visible', error: 'hidden', alert: 'rgb(255, 176, 167)',
      future: 'rgb(40, 50, 60)', futureRadius: '3px', futureCanvas: 'relative',
      defaultLight: 'rgb(248, 245, 239)', defaultDark: 'rgb(23, 27, 36)'
    }
    assert.deepEqual(await computed(), expected)
    // A second v1 stylesheet may coexist; customizations still win.
    await styles.addStyleTag({ content: v1CSS })
    assert.deepEqual(await computed(), expected)
    await styles.evaluate(() => document.querySelector('#host').style.setProperty('--knot-viewer-v1-background', 'rgb(7,8,9)'))
    assert.deepEqual(await computed(), { ...expected, light: 'rgb(7, 8, 9)', dark: 'rgb(7, 8, 9)' })
    await styles.evaluate(() => {
      document.querySelector('#host').style.removeProperty('--knot-viewer-v1-background')
      document.querySelector('#light').setAttribute('data-theme', 'dark')
    })
    assert.deepEqual(await computed(), { ...expected, light: expected.defaultDark, dark: expected.defaultDark })
  }
  await styles.close()
  console.log('CSS: inherited/local overrides, theme defaults, duplicate v1 CSS and major-generation namespace isolation in both load orders passed')
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } })
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  await page.addInitScript(() => {
    window.__webglContexts = 0
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith('webgl')) window.__webglContexts++
      return original.call(this, type, ...args)
    }
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/preview.html`)
  const setInput = async input => {
    await page.evaluate(value => window.__previewSetInput(value), input)
    await page.waitForFunction(() => window.__previewReady || window.__previewError)
    return page.evaluate(() => window.__previewError)
  }
  const invalid = fixture('v1/spec/examples/assets/invalid/dimension.json')
  assert.match(await setInput({ asset: invalid }), /INVALID_MODEL/)
  assert.equal(await page.evaluate(() => window.__webglContexts), 0, 'Malformed asset must fail before WebGL allocation')

  for (const model of ['overhand', 'twisted-loop']) {
    assert.equal(await setInput({ asset: fixture(`v1/spec/examples/assets/${model}.json`) }), undefined)
    const capture = await page.evaluate(async () => {
      const blob = await window.__previewCapture(240, 180)
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 180
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0)
      const pixels = ctx.getImageData(0, 0, 240, 180).data
      let colored = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 230 && pixels[i + 1] < 200) colored++
      bitmap.close()
      return { size: blob.size, width: canvas.width, height: canvas.height, colored }
    })
    assert.ok(capture.size > 1000 && capture.colored > 100, `${model}: capture must contain rendered geometry`)
    console.log(`${model}: render and 240×180 PNG capture passed`)
  }
  const orthographic = fixture('v1/spec/examples/assets/open-rope.json')
  orthographic.representations[0].views = [{ id: 'ortho', name: 'Orthographic', space: 'space', camera: { mode: 'fit', direction: [0,0,1], up: [0,1,0], projection: { kind: 'orthographic' } } }]
  orthographic.representations[0].defaultView = { id: 'ortho' }
  assert.equal(await setInput({ asset: orthographic }), undefined)
  assert.ok(await page.evaluate(async () => (await window.__previewCapture(320,180)).size) > 1000)
  const asset = fixture('v1/spec/examples/assets/procedures.json')
  assert.equal(await setInput({ asset, selection: { representationId: 'view-3d-rest' } }), undefined)
  const capturePixels = () => page.evaluate(async () => {
    const blob = await window.__previewCapture(240, 180)
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  const before = await capturePixels()
  assert.equal(await setInput({ asset, selection: { representationId: 'view-3d-finish' } }), undefined)
  const after = await capturePixels()
  assert.ok(before.length > 1000 && after.length > 1000)
  assert.notDeepEqual(before, after, 'Representation selection must change the captured geometry')
  assert.match(await setInput({ asset, selection: { representationId: 'missing' } }), /INVALID_MODEL/)
  assert.equal(await page.locator('.knot-viewer-v1').getAttribute('data-state'), 'error')
  assert.equal(await setInput({ asset }), undefined)
  assert.deepEqual(failures, [])
  console.log('KnotAsset: render, representation replacement, PNG capture, invalid selection, and recovery passed')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?lang=uk`)
  await page.waitForSelector('.knot-viewer-v1[data-state="ready"]')
  await page.locator('.model-select select').selectOption('asset')
  await page.waitForSelector('.knot-viewer-v1[data-state="ready"]')
  await page.locator('.representation-select').selectOption('view-3d-finish')
  await page.waitForSelector('.knot-viewer-v1[data-state="ready"]')
  assert.deepEqual(failures, [])
  const editor = page.locator('.editor textarea')
  assert.ok(await editor.isVisible(), 'KnotAsset must use the same visible JSON editor')
  assert.equal(JSON.parse(await editor.inputValue()).representations.length, 3)
  const waitForModel = async id => {
    // Filling the editor scrolls the narrow layout; hidden viewers intentionally pause rendering.
    await page.locator('.knot-viewer-v1').scrollIntoViewIfNeeded()
    try {
      await page.waitForFunction(value => {
        const viewer = document.querySelector('.knot-viewer-v1')
        return viewer?.getAttribute('data-state') === 'ready' && viewer.getAttribute('aria-label') === value
      }, id, { timeout: 10000 })
    } catch (error) {
      console.error(await page.evaluate(() => ({ state: document.querySelector('.knot-viewer-v1')?.getAttribute('data-state'), label: document.querySelector('.knot-viewer-v1')?.getAttribute('aria-label'), issue: document.querySelector('.editor pre')?.textContent })))
      throw error
    }
  }
  const edited = structuredClone(asset)
  edited.id = 'edited-asset'
  edited.representations[2].data.curves[0].points[1][1] += 0.1
  await editor.fill(JSON.stringify(edited))
  await waitForModel('edited-asset')
  assert.equal(await page.locator('.representation-select').inputValue(), 'view-3d-finish', 'Editing must preserve selected representation')
  assert.equal(await page.locator('.model-select select').inputValue(), 'custom')
  const invalidDraft = structuredClone(edited); invalidDraft.units = 'relative'
  await editor.fill(JSON.stringify(invalidDraft))
  await page.waitForSelector('.editor pre[role="alert"]')
  assert.equal(await page.locator('.knot-viewer-v1').getAttribute('aria-label'), 'edited-asset', 'Invalid edits must retain last valid model')
  await editor.fill(JSON.stringify({ ...edited, id: 'recovered-asset' }))
  await waitForModel('recovered-asset')
  const saveJSON = async filename => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Зберегти в файл', exact: true }).click()
    ])
    assert.equal(download.suggestedFilename(), filename)
    const stream = await download.createReadStream(), chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), JSON.parse(await editor.inputValue()))
  }
  await saveJSON('knot-asset.json')
  const imported = fixture('v1/spec/examples/assets/open-rope.json')
  imported.id = 'imported-asset'
  imported.representations[0].id = 'import-view'
  imported.representations.push({ ...structuredClone(imported.representations[0]), id: 'second-view' })
  await page.locator('input[type="file"]').setInputFiles({ name: 'asset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) })
  await waitForModel('imported-asset')
  assert.equal(await page.locator('.representation-select').inputValue(), 'import-view')
  await page.locator('.representation-select').selectOption('second-view')
  await page.waitForSelector('.knot-viewer-v1[data-state="ready"]')
  await page.locator('.model-select select').selectOption('loop')
  await waitForModel('twisted-loop')
  assert.equal(await page.locator('.snapshot-select').count(), 0)
  assert.equal(JSON.parse(await editor.inputValue()).schema, 'KnotAsset')
  assert.ok(JSON.parse(await editor.inputValue()).subject)
  assert.deepEqual(failures, [])
  assert.equal(await page.getByRole('button', { name: 'Експорт в PNG', exact: true }).count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Експорт прев’ю в PNG', exact: true }).count(), 0)
  const exportPNG = async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Експорт в PNG', exact: true }).click()
    ])
    assert.equal(download.suggestedFilename(), 'knot-current.png')
    const stream = await download.createReadStream(), chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const png = Buffer.concat(chunks)
    assert.equal(png.readUInt32BE(16), 512)
    assert.equal(png.readUInt32BE(20), 512)
    return png
  }
  await exportPNG()
  assert.equal(await page.locator('.presentation-select').count(), 0)
  const square = await page.locator('.knot-viewer-v1').boundingBox()
  assert.ok(Math.abs(square.width - square.height) < 1, 'Viewer must remain square')
  assert.deepEqual(failures, [])
  console.log('Demo: current-image PNG export and square viewer passed')
  console.log('Demo: asset JSON editing, validation recovery, representation preservation, representation selection, import and save passed')
} finally {
  await browser?.close()
  await server.close()
}
