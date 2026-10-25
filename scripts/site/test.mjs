import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, access, cp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { JSDOM } from 'jsdom'
const run = promisify(execFile)
const temp = await mkdtemp(path.join(tmpdir(), 'knot-site-'))
const output = path.join(temp, 'output'), archives = path.join(temp, 'archives')
const sources = path.join(temp, 'sources')
const env = { ...process.env, SITE_OUTPUT_DIR: output, SITE_ARCHIVES_DIR: archives, SITE_SOURCE_DIR: sources }
const version = JSON.parse(await readFile('package.json', 'utf8')).version
async function files(dir) {
 const result=[]
 for (const e of await readdir(dir, { withFileTypes:true })) {
  const file=path.join(dir,e.name)
  if(e.isDirectory()) result.push(...await files(file)); else result.push(file)
 }
 return result
}
try {
 await mkdir(archives)
 await mkdir(sources)
 await cp('v1', path.join(sources, 'v1'), { recursive: true })
 for (const section of ['guide', 'specifications', 'schema', 'examples']) await mkdir(path.join(sources, 'v2', section), { recursive: true })
 await writeFile(path.join(sources, 'v2/version.json'), JSON.stringify({ packageVersion: '2.0.0', schemaVersion: 2, status: 'development' }))
 await writeFile(path.join(sources, 'v2/guide/future.md'), '# Future guide\n\n[First generation](../../v1/specifications/knot.md)')
 await writeFile(path.join(sources, 'v2/specifications/format.md'), '# Future format')
 await writeFile(path.join(sources, 'v1/guide/cross-generation.md'), '# Generations\n\n[Future format](../../v2/specifications/format.md)')
 await writeFile(path.join(sources, 'v2/schema/marker.json'), '{"generation":2}')
 await cp('design', path.join(sources, 'design'), { recursive: true })
 for (const f of ['v2/guide/future', 'v2/specifications/format', 'v1/guide/cross-generation']) await cp(path.join(sources,f+'.md'),path.join(sources,f+'.uk.md'))
 await run('node', ['scripts/site/archive.mjs'], { env })
 const snapshot = path.join(archives, version)
 const before = new Map(await Promise.all((await files(snapshot)).map(async f => [f, await readFile(f)])))
 await assert.rejects(run('node', ['scripts/site/archive.mjs'], { env }), /Archive already exists/)
 await run('node', ['scripts/site/build.mjs'], { env })
 for(const [file, bytes] of before) {
  assert.deepEqual(await readFile(file), bytes)
  assert.deepEqual(await readFile(path.join(output,'releases',version,path.relative(snapshot,file))), bytes)
 }
 const versions=JSON.parse(await readFile(path.join(output,'versions.json'),'utf8'))
 assert.equal(versions.releases[0].version,version)
 assert.deepEqual(versions.generations.map(g => g.schemaVersion), [1, 2])
 assert.equal(versions.current.path, 'v1/')
 await assert.rejects(access(path.join(output, 'v1/spec')))
 await assert.rejects(access(path.join(output, 'v1/spec.html')))
 assert.equal(JSON.parse(await readFile(path.join(output, 'v2/schema/marker.json'), 'utf8')).generation, 2)
 await assert.rejects(access(path.join(output, 'v1/specifications/schema')))
 await assert.rejects(access(path.join(output, 'v1/specifications/examples')))
 assert.equal(await readFile(path.join(output, 'v1/examples/knots/open-rope.json'), 'utf8'), await readFile(path.join(sources, 'v1/examples/knots/open-rope.json'), 'utf8'))
 for (const name of await readdir(path.join(sources, 'v1/schema'))) {
  const published = await readFile(path.join(output, 'v1/schema', name), 'utf8')
  assert.equal(published, await readFile(path.join(sources, 'v1/schema', name), 'utf8'))
  assert.equal(JSON.parse(published).$id, `https://yuriyapostol.github.io/knot-engine/v1/schema/${name}`)
 }
 assert.match(await readFile(path.join(output, 'v2/guide/future.html'), 'utf8'), /class="contract-version">v2/)
 assert.doesNotMatch(await readFile(path.join(output, 'v2/guide/future.html'), 'utf8'), /data-knot-engine-demo|_example\/knots/)
 assert.doesNotMatch(await readFile(path.join(output, 'v1/specifications/components.html'), 'utf8'), /<script type="module"/)
 assert.match(await readFile(path.join(snapshot, 'guide/getting-started.html'), 'utf8'), /data-knot-engine-demo="v1"/)
 assert.doesNotMatch(await readFile(path.join(snapshot, 'guide/getting-started.html'), 'utf8'), /<iframe/)
 await assert.rejects(access(path.join(output, 'releases', version, 'v2')))

 for (const bundle of ['v1',`releases/${version}`]) {
  await access(path.join(output,bundle,'specifications/knot.html'))
  const schema=JSON.parse(await readFile(path.join(output,bundle,'schema/knot.schema.json'),'utf8'))
  assert.equal(schema.$id,'https://yuriyapostol.github.io/knot-engine/v1/schema/knot.schema.json')
 }
 const english = new JSDOM(await readFile(path.join(output,'v1/guide/getting-started.html'),'utf8'))
 assert.equal(english.window.document.documentElement.lang, 'en')
 assert.match(english.window.document.querySelector('[hreflang="uk"]').getAttribute('href'), /^getting-started\.uk\.html$/)
 assert.equal(english.window.document.querySelector('iframe'), null)
 assert.ok(english.window.document.querySelector('[data-knot-engine-demo="v1"]'))
 assert.ok(english.window.document.querySelector('script[type="module"][src*="_example/knots/"]'))
 assert.ok(english.window.document.querySelector('link[rel="stylesheet"][href*="_example/knots/"]'))
 english.window.close()
 const ukrainian = new JSDOM(await readFile(path.join(output, 'design/architecture.uk.html'), 'utf8'))
 assert.equal(ukrainian.window.document.documentElement.lang, 'uk')
 assert.equal(ukrainian.window.document.querySelector('[hreflang="uk"]').getAttribute('href'), 'architecture.uk.html')
 assert.equal(ukrainian.window.document.querySelector('[hreflang="en"]').getAttribute('href'), 'architecture.html')
 ukrainian.window.close()
 for (const key of ['index', 'guide', 'specifications', 'resources', 'schema', 'examples']) {
  for (const lang of ['en', 'uk']) {
   const name = key + (lang === 'uk' ? '.uk' : '') + '.html'
   const page = new JSDOM(await readFile(path.join(output, 'v1', name), 'utf8'))
   for (const code of ['en', 'uk']) {
    const counterpart = key + (code === 'uk' ? '.uk' : '') + '.html'
    const href = page.window.document.querySelector(`[hreflang="${code}"]`).getAttribute('href')
    assert.equal(path.posix.normalize(path.posix.join(path.posix.dirname(name), href)), counterpart)
   }
   page.window.close()
  }
 }
 await assert.rejects(access(path.join(output, 'design/uk')))
 await access(path.join(snapshot, 'index.uk.html'))
 await rm(path.join(sources,'v2/specifications/format.md'))
 await assert.rejects(run('node',['scripts/site/build.mjs'],{env}),/Missing translation/)
 let count=0
 for(const file of await files(output)) {
  if(!file.endsWith('.html')) continue
  const dom=new JSDOM(await readFile(file,'utf8'))
  for(const el of dom.window.document.querySelectorAll('[href], [src]')) {
   const href=el.getAttribute('href') || el.getAttribute('src')
   if(!href || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue
   assert.ok(!href.startsWith('/'),`Non-relocatable URL: ${file}: ${href}`)
   const target=path.resolve(path.dirname(file),decodeURIComponent(href.split(/[?#]/)[0]))
   await access(target).catch(() => { throw new Error(`Broken link: ${file}: ${href}`) })
   count++
  }
  dom.window.close()
 }
 console.log(`Site checks passed: ${count} links; canonical schemas; v1 and v2 published together; archive preserved; overwrite rejected.`)
} finally { await rm(temp,{recursive:true,force:true}) }
