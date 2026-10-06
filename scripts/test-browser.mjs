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

  for (const model of ['overhand', 'prototype-loop']) {
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`)
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  await page.locator('.model-select select').selectOption('asset')
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  await page.locator('.panel > label select').last().selectOption('finish')
  await page.waitForSelector('.knot-viewer[data-state="ready"]')
  assert.deepEqual(failures, [])
  console.log('Demo: legacy default and KnotAsset snapshot selection passed')
} finally {
  await browser?.close()
  await server.close()
}
