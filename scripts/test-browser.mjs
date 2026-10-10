import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const fixture = path => JSON.parse(readFileSync(path, 'utf8'))
const server = await createServer({ configFile: resolve('demo/vite.config.ts'), server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
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
  const invalid = fixture('examples/assets/invalid/dimension.json')
  assert.match(await setInput({ asset: invalid }), /INVALID_MODEL/)
  assert.equal(await page.evaluate(() => window.__webglContexts), 0, 'Malformed asset must fail before WebGL allocation')

  for (const model of ['overhand', 'twisted-loop']) {
    assert.equal(await setInput({ model: fixture(`examples/models/${model}.json`) }), undefined)
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
    console.log(`Legacy ${model}: render and 240×180 PNG capture passed`)
  }
  const asset = fixture('examples/assets/variants.json')
  assert.equal(await setInput({ asset, selection: { representationId: 'view-3d', snapshotId: 'rest' } }), undefined)
  const capturePixels = () => page.evaluate(async () => {
    const blob = await window.__previewCapture(240, 180)
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  const before = await capturePixels()
  assert.equal(await setInput({ asset, selection: { representationId: 'view-3d', snapshotId: 'finish' } }), undefined)
  const after = await capturePixels()
  assert.ok(before.length > 1000 && after.length > 1000)
  assert.notDeepEqual(before, after, 'Snapshot selection must change the captured geometry')
  assert.match(await setInput({ asset, selection: { snapshotId: 'missing' } }), /INVALID_MODEL/)
  assert.equal(await page.locator('.knot-viewer').getAttribute('data-state'), 'error')
  assert.match(await setInput({ asset, model: fixture('examples/models/overhand.json') }), /INVALID_MODEL/)
  assert.equal(await setInput({ asset }), undefined)
  assert.deepEqual(failures, [])
  console.log('KnotAsset: render, snapshot replacement, PNG capture, invalid selection, input conflict, and recovery passed')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  await page.locator('.model-select select').selectOption('asset')
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  await page.locator('.snapshot-select').selectOption('finish')
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  assert.deepEqual(failures, [])
  const editor = page.locator('.editor textarea')
  assert.ok(await editor.isVisible(), 'KnotAsset must use the same visible JSON editor')
  assert.equal(JSON.parse(await editor.inputValue()).representations[0].snapshots.length, 3)
  const waitForModel = async id => {
    // Filling the editor scrolls the narrow layout; hidden viewers intentionally pause rendering.
    await page.locator('.knot-viewer').scrollIntoViewIfNeeded()
    try {
      await page.waitForFunction(value => {
        const viewer = document.querySelector('.knot-viewer')
        return viewer?.getAttribute('data-state') === 'ready' && viewer.getAttribute('aria-label') === value
      }, id, { timeout: 10000 })
    } catch (error) {
      console.error(await page.evaluate(() => ({ state: document.querySelector('.knot-viewer')?.getAttribute('data-state'), label: document.querySelector('.knot-viewer')?.getAttribute('aria-label'), issue: document.querySelector('.editor pre')?.textContent })))
      throw error
    }
  }
  const edited = structuredClone(asset)
  edited.id = 'edited-asset'
  edited.representations[0].snapshots[2].elements[0].geometry.points[1][1] += 0.1
  await editor.fill(JSON.stringify(edited))
  await waitForModel('edited-asset')
  assert.equal(await page.locator('.snapshot-select').inputValue(), 'finish', 'Editing must preserve selected snapshot')
  assert.equal(await page.locator('.model-select select').inputValue(), 'custom')
  const invalidDraft = structuredClone(edited); invalidDraft.units = 'relative'
  await editor.fill(JSON.stringify(invalidDraft))
  await page.waitForSelector('.editor pre[role="alert"]')
  assert.equal(await page.locator('.knot-viewer').getAttribute('aria-label'), 'edited-asset', 'Invalid edits must retain last valid model')
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
  const imported = fixture('examples/assets/open-rope.json')
  imported.id = 'imported-asset'
  imported.representations[0].id = 'import-view'
  imported.representations[0].snapshots[0].id = 'import-state'
  imported.representations.push({ ...structuredClone(imported.representations[0]), id: 'second-view' })
  await page.locator('input[type="file"]').setInputFiles({ name: 'asset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) })
  await waitForModel('imported-asset')
  assert.equal(await page.locator('.snapshot-select').inputValue(), 'import-state')
  assert.equal(await page.locator('.representation-select').inputValue(), 'import-view')
  await page.locator('.representation-select').selectOption('second-view')
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  assert.equal(await page.locator('.snapshot-select').inputValue(), 'import-state')
  await page.locator('.model-select select').selectOption('loop')
  await waitForModel('twisted-loop')
  assert.equal(await page.locator('.snapshot-select').count(), 0)
  assert.equal(JSON.parse(await editor.inputValue()).units, 'relative')
  const legacyEdit = fixture('examples/models/twisted-loop.json'); legacyEdit.id = 'edited-legacy'
  await editor.fill(JSON.stringify(legacyEdit))
  await waitForModel('edited-legacy')
  await saveJSON('knot-model.json')
  // Importing the other contract uses the same file control and restores its selection UI.
  await page.locator('input[type="file"]').setInputFiles({ name: 'asset.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) })
  await waitForModel('imported-asset')
  await page.locator('input[type="file"]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacyEdit)) })
  await waitForModel('edited-legacy')
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
  const square = await page.locator('.knot-viewer').boundingBox()
  assert.ok(Math.abs(square.width - square.height) < 1, 'Viewer must remain square')
  assert.deepEqual(failures, [])
  console.log('Demo: current-image PNG export and square viewer passed')
  console.log('Demo: shared legacy/asset JSON editing, validation recovery, snapshot preservation, representation selection, import and save passed')
} finally {
  await browser?.close()
  await server.close()
}
