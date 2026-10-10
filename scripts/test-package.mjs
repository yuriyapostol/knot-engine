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
  for (const schema of ['knot-model-v1', 'knot-asset-v1']) assert.ok(JSON.parse(readFileSync(join(installed, 'schema', `${schema}.schema.json`), 'utf8')).$id)
  writeFileSync(join(temp, 'core-loader.mjs'), `export async function resolve(id, context, next) { if (['vue', 'three'].some(name => id === name || id.startsWith(name + '/'))) throw new Error('Core imported '+id); return next(id, context) }`)
  writeFileSync(join(temp, 'core.mjs'), `
    import assert from 'node:assert/strict'
    for (const key of ['window','document','WebGLRenderingContext']) Object.defineProperty(globalThis, key, { get() { throw new Error('DOM access: '+key) } })
    const core = await import('knot-engine/core')
    assert.equal(core.validateKnotAsset(${readFileSync('examples/assets/open-rope.json', 'utf8')}).valid, true)
    assert.equal(core.validateKnotModelV1(${readFileSync('examples/models/twisted-loop.json', 'utf8')}).valid, true)
    assert.equal(core.resolveKnotAsset(${readFileSync('examples/assets/open-rope.json', 'utf8')}).curves.length, 1)
  `)
  execFileSync(process.execPath, ['--no-warnings', '--experimental-loader', join(temp, 'core-loader.mjs'), join(temp, 'core.mjs')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'ssr.mjs'), `
    import assert from 'node:assert/strict'
    import { createSSRApp } from 'vue'
    import { renderToString } from 'vue/server-renderer'
    import { KnotViewer } from 'knot-engine'
    const html = await renderToString(createSSRApp(KnotViewer, { asset: ${readFileSync('examples/assets/open-rope.json', 'utf8')}, label: 'Tarball asset' }))
    assert.ok(html.includes('Tarball asset') && !html.includes('<canvas'))
  `)
  execFileSync(process.execPath, [join(temp, 'ssr.mjs')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'check.ts'), `
    import { KnotViewer, type KnotAsset, type CameraView } from 'knot-engine'
    import { validateKnotAsset, resolveKnotAsset, validateKnotModelV1, type Representation } from 'knot-engine/core'
    const representation: Representation<3> = { id: 'r', dimension: 3, snapshots: [] }
    const asset: KnotAsset = { schemaVersion: 1, id: 'a', units: 'm', elements: [], representations: [representation] }
    const camera: CameraView = { position: [0,0,1], target: [0,0,0], fov: 55 }
    type Props = InstanceType<typeof KnotViewer>['$props']
    const props: Props = { asset, representationId: 'r', snapshotId: 's', label: 'a', initialCamera: camera }
    validateKnotAsset(props.asset); validateKnotModelV1(null); resolveKnotAsset(asset)
  `)
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--target', 'ES2022', join(temp, 'check.ts')], { cwd: temp, stdio: 'pipe', encoding: 'utf8' })
  writeFileSync(join(temp, 'index.html'), '<div id="app"></div><script type="module" src="/client.js"></script>')
  writeFileSync(join(temp, 'client.js'), `import { createApp, h } from 'vue'; import { KnotViewer } from 'knot-engine'; import 'knot-engine/styles.css'; createApp({render:()=>h(KnotViewer,{model:null,label:'Tarball viewer'})}).mount('#app')`)
  await build({ configFile: false, root: temp, logLevel: 'warn', build: { outDir: join(temp, 'build'), minify: false } })
  console.log('Tarball: package identity, both schemas, core without Vue/Three/DOM, SSR, public declarations, and client CSS/build passed')
} finally { rmSync(temp, { recursive: true, force: true }) }
