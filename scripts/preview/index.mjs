import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const args = process.argv.slice(2)
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1] }
const modelPath = option('--model')
const outputPath = option('--out')
const width = Number(option('--width') ?? 512)
const height = Number(option('--height') ?? 512)
if (!modelPath || !outputPath || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 2048 || height > 2048) {
  console.error('Usage: npm run preview:model -- --model path.json --out preview.png [--width 512 --height 512]')
  process.exit(2)
}
const source = readFileSync(resolve(modelPath), 'utf8')
if (Buffer.byteLength(source) > 1024 * 1024) throw new Error('Model file exceeds 1 MiB')
const model = JSON.parse(source)
const server = await createServer({ configFile: resolve('demo/vite.config.ts'), server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : chromium.executablePath()), headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] })
  const browserVersion = browser.version()
  const hash = createHash('sha256').update(source).update(JSON.stringify({ width, height, rendererVersion: '0.1.0', preset: 'light-outline-v1', browserVersion })).digest('hex')
  const output = resolve(outputPath)
  if (existsSync(output) && existsSync(`${output}.sha256`) && readFileSync(`${output}.sha256`, 'utf8') === hash) {
    console.log(`Cached: ${output}`)
    process.exitCode = 0
  } else {
    const page = await browser.newPage({ viewport: { width: Math.max(width, 320), height: Math.max(height, 320) }, deviceScaleFactor: 1 })
    await page.addInitScript(value => { window.__previewModel = value }, model)
    const address = server.httpServer.address()
    await page.goto(`http://127.0.0.1:${address.port}/preview.html`, { waitUntil: 'load' })
    await page.waitForFunction(() => window.__previewReady || window.__previewError, null, { timeout: 15000 })
    const problem = await page.evaluate(() => window.__previewError)
    if (problem) throw new Error(problem)
    const dataUrl = await page.evaluate(async ([w, h]) => {
      const blob = await window.__previewCapture(w, h)
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }, [width, height])
    const png = Buffer.from(dataUrl.split(',')[1], 'base64')
    if (png.length < 100 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Capture did not return a valid PNG')
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, png)
    writeFileSync(`${output}.sha256`, hash)
    console.log(`Wrote ${output} (${width}×${height}, ${png.length} bytes)`)
  }
} finally {
  await browser?.close()
  await server.close()
}
