import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'

const root = process.cwd()
const temp = mkdtempSync(join(tmpdir(), 'knot-engine-consumer-'))
try {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', temp], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_cache: join(temp, 'cache') } }))
  assert.equal(pack.name, 'knot-engine')
  const modules = join(temp, 'node_modules'); mkdirSync(modules)
  const installed = join(modules, 'knot-engine'); mkdirSync(installed)
  execFileSync('tar', ['-xzf', join(temp, pack.filename), '--strip-components=1', '-C', installed])
  // Only peer/runtime dependencies come from the workspace; package code comes from the tarball.
  for (const dependency of ['vue', 'three', '@types']) symlinkSync(resolve('node_modules', dependency), join(modules, dependency), 'dir')
  writeFileSync(join(temp, 'package.json'), '{"type":"module"}')
  const metadata = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  assert.equal(metadata.name, 'knot-engine')
  assert.ok(pack.files.some(f => f.path.startsWith('v1/schema/')))
  assert.ok(pack.files.every(f => !/^v(?!1\/)[0-9]+\//.test(f.path)))
  assert.ok(pack.files.every(f => !f.path.startsWith('site/')))
  for (const schema of ['knot', 'spatial-curve', 'grid-diagram', 'pd-code', 'dt-code', 'source', 'contribution', 'license', 'knot-resource-registry']) assert.ok(JSON.parse(readFileSync(join(installed, 'v1', 'schema', `${schema}.schema.json`), 'utf8')).$id)
  writeFileSync(join(temp, 'core-loader.mjs'), `export async function resolve(id, context, next) { if (['vue', 'three'].some(name => id === name || id.startsWith(name + '/'))) throw new Error('Core imported '+id); return next(id, context) }`)
  writeFileSync(join(temp, 'core.mjs'), `
    import assert from 'node:assert/strict'
    assert.equal(import.meta.resolve('knot-engine/schema/dt-code.schema.json'), new URL('./node_modules/knot-engine/v1/schema/dt-code.schema.json', import.meta.url).href)
    assert.equal(import.meta.resolve('knot-engine/schema/knot.schema.json'), new URL('./node_modules/knot-engine/v1/schema/knot.schema.json', import.meta.url).href)
    for (const key of ['window','document','WebGLRenderingContext']) Object.defineProperty(globalThis, key, { get() { throw new Error('DOM access: '+key) } })
    const core = await import('knot-engine/core')
    assert.equal(core.validateKnot(${readFileSync('v1/examples/knots/open-rope.json', 'utf8')}).valid, true)
    assert.equal(core.validateDTCode({convention: core.DT_SIGNED_EVEN, code: [4,6,2]}).valid, true)
    assert.equal(core.validateDTCode({convention: core.DT_SIGNED_EVEN, code: [[4],[2]]}).componentCount, 2)
    assert.equal(core.validatePDCode({convention: core.PD_CCW_UNDER_FIRST, crossings: [], unlinkedComponents: 1}).componentCount, 1)
    assert.equal(core.resolveKnot(${readFileSync('v1/examples/knots/open-rope.json', 'utf8')}).curves.length, 1)
  `)
  execFileSync(process.execPath, ['--no-warnings', '--experimental-loader', join(temp, 'core-loader.mjs'), join(temp, 'core.mjs')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'subpaths.mjs'), `
    import assert from 'node:assert/strict'
    import { createSSRApp } from 'vue'
    import { renderToString } from 'vue/server-renderer'
    import { Knot3DViewer } from 'knot-engine/3d'
    import { KnotMosaicViewer } from 'knot-engine/mosaic'
    assert.equal(typeof Knot3DViewer, 'object')
    assert.equal(typeof KnotMosaicViewer, 'object')
    const html = await renderToString(createSSRApp(KnotMosaicViewer, { label: 'Mosaic standalone' }))
    assert.ok(html.includes('Mosaic standalone'))
  `)
  execFileSync(process.execPath, [join(temp, 'subpaths.mjs')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'ssr.mjs'), `
    import assert from 'node:assert/strict'
    import { createSSRApp } from 'vue'
    import { renderToString } from 'vue/server-renderer'
    import { KnotViewer } from 'knot-engine'
    const html = await renderToString(createSSRApp(KnotViewer, { knot: ${readFileSync('v1/examples/knots/open-rope.json', 'utf8')}, label: 'Tarball knot' }))
    assert.ok(html.includes('Tarball knot') && !html.includes('<canvas'))
  `)
  execFileSync(process.execPath, [join(temp, 'ssr.mjs')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'check.ts'), `
    import { KnotViewer, type RawKnot, type CameraView } from 'knot-engine'
    import { Knot3DViewer } from 'knot-engine/3d'
    import { KnotMosaicViewer } from 'knot-engine/mosaic'
    import { validateKnot, resolveKnot, type RawRepresentation, type DTCode, DT_SIGNED_EVEN, validateDTCode, type PDCode, type SourceDefinition, type Contribution, type License, validatePDCode, PD_CCW_UNDER_FIRST } from 'knot-engine/core'
    const representation: RawRepresentation = { id: 'r', type: 'urn:example:representation', data: {} }
    const knot: RawKnot = { schema: 'Knot', schemaVersion: 1, id: 'a', subject: { id: 's' }, representations: [representation] }
    const camera: CameraView = { mode: 'fixed', position: [0,0,1], target: [0,0,0], up: [0,1,0], projection: { kind: 'perspective', fovY: 1 } }
    type Props = InstanceType<typeof KnotViewer>['$props']
    const props: Props = { knot, representationId: 'r', label: 'a', initialCamera: camera }
    const threeProps: InstanceType<typeof Knot3DViewer>['$props'] = { label: '3d', knot }
    const mosaicProps: InstanceType<typeof KnotMosaicViewer>['$props'] = { label: 'mosaic', knot }
    void threeProps; void mosaicProps
    const pd: PDCode = { convention: PD_CCW_UNDER_FIRST, crossings: [[1,1,2,2]] }
    validatePDCode(pd)
    const dt: DTCode = { convention: DT_SIGNED_EVEN, code: [[4],[2]] }
    validateDTCode(dt)
    const source: SourceDefinition = { id: 'book', title: 'Book' }
    const contribution: Contribution = { name: 'Editor', roles: ['editing'] }
    const license: License = { name: 'Example terms' }
    validateKnot({ ...knot, sources: [source], contributions: [contribution], license })
    validateKnot(props.knot); resolveKnot(knot)
  `)
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--target', 'ES2022', join(temp, 'check.ts')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'index.html'), '<div id="app"></div><script type="module" src="/client.js"></script>')
  writeFileSync(join(temp, 'client.js'), `import { createApp, h } from 'vue'; import { KnotViewer } from 'knot-engine'; import 'knot-engine/styles.css'; createApp({render:()=>h(KnotViewer,{knot:null,label:'Tarball viewer'})}).mount('#app')`)
  await build({ configFile: false, root: temp, logLevel: 'warn', build: { outDir: join(temp, 'build'), minify: false } })
  console.log('Tarball: package identity, independent schemas, core without Vue/Three/DOM, SSR, public declarations, and client CSS/build passed')
} finally { rmSync(temp, { recursive: true, force: true }) }
