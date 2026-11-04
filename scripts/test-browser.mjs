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
  // Probe generation and component namespaces with representative CSS, not future runtimes.
  const styles = await browser.newPage()
  const v1CSS = readFileSync('src/styles.css', 'utf8')
  const v2CSS = `.knot-engine-v2-viewer{background:var(--knot-engine-v2-viewer-background,rgb(40,50,60));border-radius:3px}.knot-engine-v2-viewer__canvas{position:relative}.knot-engine-v1-probe{background:rgb(70,80,90)}.knot-engine-v1-probe__canvas{position:relative}`
  for (const sheets of [[v1CSS, v2CSS], [v2CSS, v1CSS]]) {
    await styles.setContent(`<section id="host" style="--knot-engine-v1-viewer-background:rgb(1,2,3);--knot-engine-v1-viewer-radius:20px;--knot-engine-v1-viewer-aspect-ratio:1;--knot-engine-v1-viewer-toolbar-gap:9px">
      <div id="light" class="knot-engine-v1-viewer" data-theme="light" data-state="ready">
        <canvas class="knot-engine-v1-viewer__canvas"></canvas>
        <div class="knot-engine-v1-viewer__toolbar"><button>Reset</button></div>
      </div>
      <div id="dark" class="knot-engine-v1-viewer" data-theme="dark" data-state="error">
        <canvas class="knot-engine-v1-viewer__canvas"></canvas>
        <div class="knot-engine-v1-viewer__fallback" role="alert">Error</div>
      </div>
      <div id="local" class="knot-engine-v1-viewer" data-theme="dark" style="--knot-engine-v1-viewer-background:rgb(4,5,6)"></div>
      <div id="future" class="knot-engine-v2-viewer"><canvas class="knot-engine-v2-viewer__canvas"></canvas></div>
      <div id="other" class="knot-engine-v1-probe"><canvas class="knot-engine-v1-probe__canvas"></canvas></div>
    </section>
    <div id="default-light" class="knot-engine-v1-viewer" data-theme="light"></div>
    <div id="default-dark" class="knot-engine-v1-viewer" data-theme="dark"></div>`)
    for (const content of sheets) await styles.addStyleTag({ content })
    const computed = () => styles.evaluate(() => {
      const css = selector => getComputedStyle(document.querySelector(selector))
      return {
        light: css('#light').backgroundColor, dark: css('#dark').backgroundColor,
        local: css('#local').backgroundColor, radius: css('#light').borderRadius,
        aspect: css('#light').aspectRatio, gap: css('#light .knot-engine-v1-viewer__toolbar').gap,
        button: css('#light button').minHeight, canvas: css('#light canvas').position,
        ready: css('#light canvas').visibility, error: css('#dark canvas').visibility,
        alert: css('#dark .knot-engine-v1-viewer__fallback').color,
        future: css('#future').backgroundColor, futureRadius: css('#future').borderRadius,
        futureCanvas: css('#future canvas').position,
        other: css('#other').backgroundColor, otherCanvas: css('#other canvas').position,
        defaultLight: css('#default-light').backgroundColor, defaultDark: css('#default-dark').backgroundColor
      }
    })
    const expected = {
      light: 'rgb(1, 2, 3)', dark: 'rgb(1, 2, 3)', local: 'rgb(4, 5, 6)',
      radius: '20px', aspect: '1 / 1', gap: '9px', button: '44px', canvas: 'absolute',
      ready: 'visible', error: 'hidden', alert: 'rgb(255, 176, 167)',
      future: 'rgb(40, 50, 60)', futureRadius: '3px', futureCanvas: 'relative',
      other: 'rgb(70, 80, 90)', otherCanvas: 'relative',
      defaultLight: 'rgb(248, 245, 239)', defaultDark: 'rgb(23, 27, 36)'
    }
    assert.deepEqual(await computed(), expected)
    await styles.evaluate(() => document.querySelector('#host').style.setProperty('--knot-engine-v1-viewer-background', 'rgb(7,8,9)'))
    assert.deepEqual(await computed(), { ...expected, light: 'rgb(7, 8, 9)', dark: 'rgb(7, 8, 9)' })
    await styles.evaluate(() => {
      document.querySelector('#host').style.removeProperty('--knot-engine-v1-viewer-background')
      document.querySelector('#light').setAttribute('data-theme', 'dark')
    })
    assert.deepEqual(await computed(), { ...expected, light: expected.defaultDark, dark: expected.defaultDark })
  }
  await styles.close()
  console.log('CSS: inherited/local overrides, theme defaults and package/component/generation namespace isolation in both load orders passed')
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
  const invalid = fixture('v1/examples/knots/invalid/dimension.json')
  assert.match(await setInput({ knot: invalid }), /^INVALID_REPRESENTATION:/)
  assert.equal(await page.evaluate(() => window.__webglContexts), 0, 'Malformed knot must fail before WebGL allocation')

  for (const model of ['overhand', 'twisted-loop']) {
    const modelKnot = fixture(`v1/examples/knots/${model}.json`)
    const representationId = modelKnot.representations.find(rep => rep.type === '3d').id
    assert.equal(await setInput({ knot: modelKnot, selection: { representationId } }), undefined)
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
  const orthographic = fixture('v1/examples/knots/open-rope.json')
  const orthographicView = { id: 'ortho', name: 'Orthographic', space: 'space', camera: { mode: 'fit', direction: [0, 0, 1], up: [0, 1, 0], projection: { kind: 'orthographic' } } }
  assert.equal(await setInput({ knot: orthographic, selection: { view: orthographicView } }), undefined)
  assert.ok(await page.evaluate(async () => (await window.__previewCapture(320,180)).size) > 1000)
  const knot = fixture('v1/examples/knots/algorithms.json')
  // Keep two full representations for the compositor selection/replacement checks.
  const rest = structuredClone(knot.representations[0]); rest.id = 'view-3d-rest'
  rest.data.elements = structuredClone(knot.algorithms[0].steps[0].data.replace)
  knot.representations.push(rest)
  assert.equal(await setInput({ knot, selection: { representationId: 'view-3d-rest' } }), undefined)
  const capturePixels = () => page.evaluate(async () => {
    const blob = await window.__previewCapture(240, 180)
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  const before = await capturePixels()
  assert.equal(await setInput({ knot, selection: { representationId: 'view-3d-finish' } }), undefined)
  const after = await capturePixels()
  assert.ok(before.length > 1000 && after.length > 1000)
  assert.notDeepEqual(before, after, 'Representation selection must change the captured geometry')
  assert.match(await setInput({ knot, selection: { representationId: 'missing' } }), /^REPRESENTATION_NOT_FOUND:/)
  assert.equal(await page.locator('.knot-engine-v1-viewer').getAttribute('data-state'), 'error')
  assert.match(await setInput({ knot }), /^AMBIGUOUS_REPRESENTATION:/)
  assert.equal(await setInput({ knot, selection: { representationId: 'view-3d-rest' } }), undefined)
  assert.deepEqual(failures, [])
  console.log('Knot: render, representation replacement, PNG capture, invalid selection, and recovery passed')
  // Exercise the actual generic compositor in Chromium: SVG, export, failure, recovery, 3D.
  const mosaic = fixture('v1/examples/knots/mosaic-diagram.json')
  const webglBeforeMosaic = await page.evaluate(() => window.__webglContexts)
  assert.equal(await setInput({ knot: mosaic }), undefined)
  assert.equal(await page.locator('.knot-engine-v1-viewer').getAttribute('data-state'), 'ready')
  assert.ok(await page.locator('svg.knot-engine-v1-mosaic path').count() > 0, 'Mosaic SVG must contain strands')
  assert.equal(await page.evaluate(() => window.__webglContexts), webglBeforeMosaic, 'Mosaic must not allocate WebGL')
  const svgExport = await page.evaluate(async () => {
    const blob = await window.__previewCapture(240, 180)
    return { type: blob.type, content: await blob.text() }
  })
  assert.equal(svgExport.type, 'image/svg+xml')
  assert.match(svgExport.content, /<svg[^>]*>/)
  assert.match(svgExport.content, /<path\b/)
  assert.match(await setInput({ knot: mosaic, selection: { representationId: 'missing' } }), /REPRESENTATION_NOT_FOUND/)
  assert.equal(await page.locator('.knot-engine-v1-viewer').getAttribute('data-state'), 'error')
  assert.equal(await setInput({ knot: mosaic, selection: { representationId: 'mosaic' } }), undefined)
  assert.ok(await page.locator('svg.knot-engine-v1-mosaic path').count() > 0)
  const geometry = fixture('v1/examples/knots/geometry-crossing-demo.json')
  const webglBefore2D = await page.evaluate(() => window.__webglContexts)
  assert.equal(await setInput({ knot: geometry, selection: { representationId: 'crossing-2d' }, interactive: true }), undefined)
  assert.equal(await page.evaluate(() => window.__webglContexts), webglBefore2D, '2D must not allocate WebGL')
  const planar = page.locator('svg.knot-engine-v1-geometry2d')
  assert.equal(await planar.count(), 1)
  const initial2D = await planar.getAttribute('viewBox')
  await planar.hover(); await page.mouse.wheel(0, -100)
  await page.waitForFunction(value => document.querySelector('svg.knot-engine-v1-geometry2d').getAttribute('viewBox') !== value, initial2D)
  const svgPixels = await page.evaluate(async () => {
    const blob = await window.__previewCapture(512, 512)
    const content = await blob.text()
    const parsed = new DOMParser().parseFromString(content, 'image/svg+xml')
    if (parsed.querySelector('parsererror')) throw new Error('Invalid exported SVG')
    const image = new Image(), url = URL.createObjectURL(blob)
    try {
      image.src = url; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      const alpha = (x, y) => context.getImageData(x, y, 1, 1).data[3]
      return { type: blob.type, background: alpha(0, 0), over: alpha(256, 256), gap: alpha(261, 261) }
    } finally { URL.revokeObjectURL(url) }
  })
  assert.deepEqual(svgPixels, { type: 'image/svg+xml', background: 0, over: 255, gap: 0 })
  // Compare our parser with the browser's SVG implementation, including shorthand resets.
  const pathAgreement = await page.evaluate(async modulePath => {
    const { importSVGPath2D, exportSVGPath2D } = await import(modulePath)
    const cases = [
      'm10 20 2 0 h2 v2 q1 2 2 0 t2 0 c1 1 2 1 3 0 s2 -1 3 0 z',
      'M0 0 Q1 2 2 0 T4 0 6 0 L7 0 T8 0 S9 2 10 0',
      'M0 0 C1 2 2 2 3 0 S5 -2 6 0 8 2 9 0z l0 1 m2 0 q1 1 2 0',
      'M.5-.5L1e1,+2.5e-1 20.30.4',
    ]
    let maxError = 0
    for (const d of cases) {
      const normalized = importSVGPath2D(d, { idPrefix: 'test', yAxis: 'down' }).map(c => exportSVGPath2D(c, { yAxis: 'down' })).join(' ')
      const paths = [d, normalized].map(value => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', value); return path
      })
      const lengths = paths.map(p => p.getTotalLength())
      maxError = Math.max(maxError, Math.abs(lengths[0] - lengths[1]))
      for (let i = 0; i <= 100; i++) {
        const [a, b] = paths.map((p, j) => p.getPointAtLength(lengths[j] * i / 100))
        maxError = Math.max(maxError, Math.hypot(a.x - b.x, a.y - b.y))
      }
    }
    return maxError
  }, `/@fs${resolve('src/core/svgPath2d.ts')}`)
  assert.ok(pathAgreement < 0.001, `SVG parser geometry must agree with native SVG: ${pathAgreement}`)
  assert.equal(await setInput({ knot: fixture('v1/examples/knots/bezier-2d.json'), selection: { representationId: 'bezier-2d' } }), undefined)
  assert.match(await planar.locator('defs > path').first().getAttribute('d'), /Q .*C .*L /)
  const bezierContinuity = await page.evaluate(async () => {
    const svg = document.querySelector('svg.knot-engine-v1-geometry2d'), group = svg.querySelector(':scope > g')
    const matrix = group.transform.baseVal.consolidate().matrix, box = svg.viewBox.baseVal
    const samples = []
    // The first curve is entirely over; the third is a single closed cubic loop.
    for (const path of [svg.querySelectorAll('defs > path')[0], svg.querySelectorAll('defs > path')[2]]) {
      const length = path.getTotalLength()
      for (let i = 0; i <= 200; i++) {
        const p = path.getPointAtLength(length * i / 200), world = new DOMPoint(p.x, p.y).matrixTransform(matrix)
        samples.push([(world.x - box.x) / box.width * 512, (world.y - box.y) / box.height * 512])
      }
    }
    const blob = await window.__previewCapture(512, 512), exported = await blob.text()
    const image = new Image(), url = URL.createObjectURL(blob)
    try {
      image.src = url; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      return { commands: /Q .*C /.test(exported), alpha: Math.min(...samples.map(([x, y]) => context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3])) }
    } finally { URL.revokeObjectURL(url) }
  })
  assert.equal(bezierContinuity.commands, true)
  assert.ok(bezierContinuity.alpha > 240, `Exported Bezier curves must remain continuous: ${JSON.stringify(bezierContinuity)}`)
  assert.equal(await page.evaluate(() => window.__webglContexts), webglBefore2D)
  // A genuinely curved spline crosses the other strand at its middle control point.
  geometry.representations[0].data.elements[0].points = [[0, 0], [1, 1], [2, 2.5]]
  geometry.representations[0].data.elements[0].interpolation = { type: 'catmull-rom', parameterization: 'centripetal' }
  assert.equal(await setInput({ knot: geometry, selection: { representationId: 'crossing-2d' }, interactive: true }), undefined)
  assert.match(await planar.locator('defs > path').first().getAttribute('d'), /C /)
  assert.equal(await page.evaluate(() => window.__webglContexts), webglBefore2D)
  assert.deepEqual(failures, [])
  geometry.representations[0].data.elements = [
    { id: 'rope-a', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[-1, 0], [1, 0]] },
    { id: 'rope-b', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[-1, -0.08], [1, 0.08]] },
  ]
  assert.equal(await setInput({ knot: geometry, selection: { representationId: 'crossing-2d' } }), undefined)
  const shallowPixels = await page.evaluate(async () => {
    const blob = await window.__previewCapture(512, 512)
    const image = new Image(), url = URL.createObjectURL(blob)
    try {
      image.src = url; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      const alpha = (x, y) => context.getImageData(x, y, 1, 1).data[3]
      return { gap: alpha(336, 250), underOutsideGap: alpha(450, 240), overInsideGap: alpha(336, 256), overOutsideGap: alpha(450, 256) }
    } finally { URL.revokeObjectURL(url) }
  })
  assert.deepEqual(shallowPixels, { gap: 0, underOutsideGap: 255, overInsideGap: 255, overOutsideGap: 255 })
  geometry.representations[0].data.elements = [
    { id: 'rope-a', type: 'curve', closed: false, interpolation: { type: 'polyline' }, points: [[0, 0], [2, 2], [0, 2], [2, 0]] },
  ]
  for (const overFirst of [true, false]) {
    geometry.representations[0].data.crossings = [
      { id: 'self', element: 'rope-a', [overFirst ? 'underElement' : 'overElement']: 'rope-a' },
      { id: 'self', element: 'rope-a', [overFirst ? 'overElement' : 'underElement']: 'rope-a' },
    ]
    assert.equal(await setInput({ knot: geometry, selection: { representationId: 'crossing-2d' } }), undefined)
    const layerPixels = await page.evaluate(async () => {
      const exported = await (await window.__previewCapture(512, 512)).text()
      const raster = async foreground => {
        const root = new DOMParser().parseFromString(exported, 'image/svg+xml').documentElement
        if (foreground) root.querySelector('g[mask]').remove()
        else for (const use of root.querySelectorAll(':scope > g > use')) use.remove()
        const blob = new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' })
        const image = new Image(), url = URL.createObjectURL(blob)
        try {
          image.src = url; await image.decode()
          const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
          const alpha = (x, y) => context.getImageData(x, y, 1, 1).data[3]
          return { start: alpha(27, 484), end: alpha(484, 484), capLeft: alpha(253, 27), capRight: alpha(258, 27) }
        } finally { URL.revokeObjectURL(url) }
      }
      return { foreground: await raster(true), background: await raster(false) }
    })
    assert.equal(layerPixels.foreground.start, overFirst ? 255 : 0, 'No foreground dot at a hidden start')
    assert.equal(layerPixels.foreground.end, overFirst ? 0 : 255, 'No foreground dot at a hidden end')
    assert.equal(layerPixels.background.start, overFirst ? 0 : 255, 'No background dot at a hidden start')
    assert.equal(layerPixels.background.end, overFirst ? 255 : 0, 'No background dot at a hidden end')
    if (overFirst) {
      assert.equal(layerPixels.foreground.capLeft, 255, 'Foreground round cap extends beyond the shared midpoint')
      assert.equal(layerPixels.background.capRight, 255, 'Inset mask preserves the background round cap')
    }
  }
  for (const scale of [1, 1e-5]) {
    const loop = fixture('v1/examples/knots/twisted-loop.json')
    const planarData = loop.representations.find(rep => rep.id === 'view-2d-finish').data
    planarData.elements[0].points = planarData.elements[0].points.map(point => point.map(value => value * scale))
    assert.equal(await setInput({ knot: loop, selection: { representationId: 'view-2d-finish' } }), undefined)
    const continuity = await page.evaluate(async () => {
      const svg = document.querySelector('svg.knot-engine-v1-geometry2d')
      const path = svg.querySelector('defs > path'), group = svg.querySelector(':scope > g')
      const matrix = group.transform.baseVal.consolidate().matrix
      const length = path.getTotalLength(), box = svg.viewBox.baseVal
      const radius = Number(group.getAttribute('stroke-width')) * Math.abs(matrix.a) * 3
      const samples = []
      for (let i = 0; i <= 240; i++) {
        const point = path.getPointAtLength(length * i / 240)
        const world = new DOMPoint(point.x, point.y).matrixTransform(matrix)
        // The central underpass gap is intentional; every other centerline must remain visible.
        if (Math.hypot(world.x, world.y) > radius) samples.push([(world.x - box.x) / box.width * 512, (world.y - box.y) / box.height * 512])
      }
      const blob = await window.__previewCapture(512, 512)
      const image = new Image(), url = URL.createObjectURL(blob)
      try {
        image.src = url; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
        return { count: samples.length, alpha: Math.min(...samples.map(([x, y]) => context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3])) }
      } finally { URL.revokeObjectURL(url) }
    })
    assert.ok(continuity.count > 200)
    assert.ok(continuity.alpha > 240, `Closed loop must remain continuous at physical scale ${scale}: ${JSON.stringify(continuity)}`)
  }
  console.log('2D: complementary rounded layers, hidden-endpoint dots, closed seams and physical-scale continuity regressions passed')
  const gridKnot = fixture('v1/examples/knots/grid-diagram.json')
  const gridXO = structuredClone(gridKnot.representations[0].data)
  const beforeGrid = await page.evaluate(() => window.__webglContexts)
  for (const encoding of ['xo', 'vertex-pairs']) {
    gridKnot.representations[0].data = encoding === 'xo' ? gridXO : {
      encoding, size: gridXO.size,
      vertices: gridXO.x.flatMap((r,c) => [[c,r],[c,gridXO.o[c]]]).reverse(),
    }
    assert.equal(await setInput({ knot: gridKnot, interactive: true }), undefined)
    const grid = page.locator('svg.knot-engine-v1-grid')
    await grid.waitFor()
    assert.equal(await grid.locator('[data-grid-marker]').count(), encoding === 'xo' ? 10 : 0)
    assert.equal(await page.evaluate(() => window.__webglContexts), beforeGrid)
    const pixels = await page.evaluate(async () => {
      const blob = await window.__previewCapture(500, 500)
      const image = new Image(), url = URL.createObjectURL(blob)
      try {
        image.src = url; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 500
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
        const alpha = (x,y) => ctx.getImageData(x,y,1,1).data[3]
        return { type: blob.type, gap: alpha(140,250), horizontal: alpha(125,250), vertical: alpha(150,250), bottom: alpha(50,400), topEmpty: alpha(50,100) }
      } finally { URL.revokeObjectURL(url) }
    })
    assert.deepEqual(pixels, { type: 'image/svg+xml', gap: 0, horizontal: 255, vertical: 255, bottom: 255, topEmpty: 0 })
    await grid.screenshot({ path: `/tmp/knot-grid-${encoding}.png` })
    const originalBox = await grid.getAttribute('viewBox')
    await grid.hover(); await page.mouse.wheel(0,-100)
    await page.waitForFunction(box => document.querySelector('svg.knot-engine-v1-grid').getAttribute('viewBox') !== box, originalBox)
  }
  console.log('Grid: both encodings, upward row coordinates, transparent crossing gaps, vertical overpasses, wheel zoom and SVG rasterization without WebGL passed')

  assert.equal(await setInput({ knot: fixture('v1/examples/knots/open-rope.json') }), undefined)
  assert.ok(await page.locator('canvas.knot-engine-v1-viewer__canvas').count() > 0)
  assert.equal(await page.evaluate(async () => (await window.__previewCapture(240, 180)).type), 'image/png')
  assert.deepEqual(failures, [])
  console.log('Generic compositor: 3D → mosaic SVG and export → invalid ID → recovery → 3D passed')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?lang=uk`)
  await page.waitForSelector('.knot-engine-v1-viewer[data-state="ready"]')
  await page.locator('.knot-engine-v1-demo__representation-select').selectOption('view-2d-closed')
  const trefoilViewer = page.locator('.knot-engine-v1-viewer[data-state="ready"][aria-label="Простий вузол"]')
  await trefoilViewer.waitFor()
  assert.equal(await page.locator('.knot-engine-v1-demo__model-select select').inputValue(), 'overhand')
  assert.equal(await page.locator('.knot-engine-v1-demo__representation-select option:checked').textContent(), '2D-представлення (замкнене)')
  const trefoilPath = await trefoilViewer.locator('defs > path').getAttribute('d')
  assert.match(trefoilPath, /C .* Z$/)
  assert.equal((trefoilPath.match(/C /g) ?? []).length, 3)
  const closedTrefoil = JSON.parse(await page.locator('textarea').inputValue()).representations.find(rep => rep.id === 'view-2d-closed')
  assert.equal(closedTrefoil.data.crossings.length, 6)
  const [trefoilDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Експорт зображення', exact: true }).click(),
  ])
  assert.equal(trefoilDownload.suggestedFilename(), 'knot-current.svg')
  await trefoilDownload.saveAs('/tmp/knot-closed-trefoil.svg')
  assert.match(readFileSync('/tmp/knot-closed-trefoil.svg', 'utf8'), /<mask/)
  await trefoilViewer.screenshot({ path: '/tmp/knot-closed-trefoil.png' })
  for (const model of ['overhand', 'loop']) {
    await page.locator('.knot-engine-v1-demo__model-select select').selectOption(model)
    for (const [encoding, name] of [['xo', 'Сіткова діаграма (X/O)'], ['vertex-pairs', 'Сіткова діаграма (пари вершин)']]) {
      await page.locator('.knot-engine-v1-demo__representation-select').selectOption(`grid-${encoding}`)
      const grid = page.locator('.knot-engine-v1-viewer[data-state="ready"] svg.knot-engine-v1-grid')
      await grid.waitFor()
      assert.equal(await page.locator('.knot-engine-v1-demo__representation-select option:checked').textContent(), name)
      assert.equal(await grid.locator('[data-grid-marker]').count(), encoding === 'xo' ? (model === 'overhand' ? 10 : 6) : 0)
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Експорт зображення', exact: true }).click(),
      ])
      assert.equal(download.suggestedFilename(), 'knot-current.svg')
      const stream = await download.createReadStream(), chunks = []
      for await (const chunk of stream) chunks.push(chunk)
      assert.match(Buffer.concat(chunks).toString(), /data-grid-strands="vertical"/)
    }
  }
  console.log('Demo: both grid encodings are selectable, render and export SVG for overhand and twisted loop')

  await page.locator('.knot-engine-v1-demo__model-select select').selectOption('loop')
  await page.waitForSelector('.knot-engine-v1-viewer[data-state="ready"]')
  await page.locator('.knot-engine-v1-demo__representation-select').selectOption('view-3d-finish')
  await page.waitForSelector('.knot-engine-v1-viewer[data-state="ready"]')
  assert.deepEqual(failures, [])
  const editor = page.locator('.knot-engine-v1-demo__editor textarea')
  assert.ok(await editor.isVisible(), 'Knot must use the same visible JSON editor')
  assert.equal(JSON.parse(await editor.inputValue()).representations.length, fixture('v1/examples/knots/twisted-loop.json').representations.length)
  const waitForModel = async id => {
    // Filling the editor scrolls the narrow layout; hidden viewers intentionally pause rendering.
    await page.locator('.knot-engine-v1-viewer').scrollIntoViewIfNeeded()
    try {
      await page.waitForFunction(value => {
        const viewer = document.querySelector('.knot-engine-v1-viewer')
        return viewer?.getAttribute('data-state') === 'ready' && viewer.getAttribute('aria-label') === value
      }, id, { timeout: 10000 })
    } catch (error) {
      console.error(await page.evaluate(() => ({ state: document.querySelector('.knot-engine-v1-viewer')?.getAttribute('data-state'), label: document.querySelector('.knot-engine-v1-viewer')?.getAttribute('aria-label'), issue: document.querySelector('.knot-engine-v1-demo__issue')?.textContent })))
      throw error
    }
  }
  const edited = structuredClone(knot)
  edited.id = 'edited-knot'
  edited.subject = { ...edited.subject, id: 'edited-knot', names: [] }
  edited.representations.find(rep => rep.id === 'view-3d-finish').data.elements[0].points[1][1] += 0.1
  await editor.fill(JSON.stringify(edited))
  await waitForModel('edited-knot')
  assert.equal(await page.locator('.knot-engine-v1-demo__representation-select').inputValue(), 'view-3d-finish', 'Editing must preserve selected representation')
  assert.equal(await page.locator('.knot-engine-v1-demo__model-select select').inputValue(), 'custom')
  const invalidDraft = structuredClone(edited); invalidDraft.units = 'relative'
  await editor.fill(JSON.stringify(invalidDraft))
  await page.waitForSelector('.knot-engine-v1-demo__issue[role="alert"]')
  assert.equal(await page.locator('.knot-engine-v1-viewer').getAttribute('aria-label'), 'edited-knot', 'Invalid edits must retain last valid model')
  await editor.fill(JSON.stringify({ ...edited, id: 'recovered-knot', subject: { ...edited.subject, id: 'recovered-knot' } }))
  await waitForModel('recovered-knot')
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
  await saveJSON('knot-knot.json')
  const imported = fixture('v1/examples/knots/open-rope.json')
  imported.id = 'imported-knot'
  imported.subject = { ...imported.subject, id: 'imported-knot', names: [] }
  imported.representations[0].id = 'import-view'
  imported.representations.push({ ...structuredClone(imported.representations[0]), id: 'second-view' })
  await page.locator('input[type="file"]').setInputFiles({ name: 'knot.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) })
  await waitForModel('imported-knot')
  assert.equal(await page.locator('.knot-engine-v1-demo__representation-select').inputValue(), 'import-view')
  await page.locator('.knot-engine-v1-demo__representation-select').selectOption('second-view')
  await page.waitForSelector('.knot-engine-v1-viewer[data-state="ready"]')
  await page.locator('.knot-engine-v1-demo__model-select select').selectOption('loop')
  await waitForModel(fixture('v1/examples/knots/twisted-loop.json').subject.names.find(entry => entry.language === 'uk').value)
  assert.equal(await page.locator('.knot-engine-v1-demo__snapshot-select').count(), 0)
  assert.equal(JSON.parse(await editor.inputValue()).schema, 'Knot')
  assert.ok(JSON.parse(await editor.inputValue()).subject)
  assert.deepEqual(failures, [])
  assert.equal(await page.getByRole('button', { name: 'Експорт зображення', exact: true }).count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Експорт прев’ю в PNG', exact: true }).count(), 0)
  const exportPNG = async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Експорт зображення', exact: true }).click()
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
  assert.equal(await page.locator('.knot-engine-v1-demo__presentation-select').count(), 0)
  const square = await page.locator('.knot-engine-v1-viewer').boundingBox()
  assert.ok(Math.abs(square.width - square.height) < 1, 'Viewer must remain square')
  assert.deepEqual(failures, [])
  console.log('Demo: current-image PNG export and square viewer passed')
  console.log('Demo: knot JSON editing, validation recovery, representation preservation, representation selection, import and save passed')
} finally {
  await browser?.close()
  await server.close()
}
