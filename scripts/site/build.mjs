import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Marked } from 'marked'
import { locales, localeOf, pageKey } from '../../site/locales.mjs'
const run = promisify(execFile)
const root = process.cwd()
const sourceRoot = path.resolve(process.env.SITE_SOURCE_DIR || root)
const output = path.resolve(process.env.SITE_OUTPUT_DIR || 'site-dist')
const archives = path.resolve(process.env.SITE_ARCHIVES_DIR || 'site/releases')
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const current = pkg.knotEngine.resourceDirectory
const commit = (await run('git', ['rev-parse', 'HEAD'])).stdout.trim()
const sourceDirty = Boolean((await run('git', ['status', '--porcelain'])).stdout.trim())
const style = await readFile('site/style.css', 'utf8')
const themeScript = await readFile('site/theme.js', 'utf8')
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const relative = (from, to) => path.posix.relative(path.posix.dirname(from), to) || './'
const route = (scope, key, lang) => [scope, `${key}${lang === 'en' ? '' : '.' + lang}.html`].filter(Boolean).join('/')
async function files(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true })
  return (await Promise.all(entries.map(async e => e.isDirectory() ? files(path.join(dir, e.name), prefix + e.name + '/') : [prefix + e.name]))).flat()
}
async function put(file, content) { const target = path.join(output, file); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content) }
const generations = (await readdir(sourceRoot, { withFileTypes: true })).filter(e => e.isDirectory() && /^v[1-9]\d*$/.test(e.name)).map(e => e.name).sort((a,b) => +a.slice(1) - +b.slice(1))
if (!generations.includes(current)) throw Error('Current package resource directory is missing')
const metadata = new Map()
const pages = new Map()
const routes = new Map()
for (const scope of [...generations, 'design']) {
  if (scope !== 'design') {
    const meta = JSON.parse(await readFile(path.join(sourceRoot, scope, 'version.json'), 'utf8'))
    if (meta.schemaVersion !== +scope.slice(1)) throw Error(`Invalid generation metadata: ${scope}`)
    if (scope === current && meta.packageVersion !== pkg.version) throw Error('Package and current generation versions differ')
    metadata.set(scope, meta)
  }
  const listing = await files(path.join(sourceRoot, scope))
  for (const name of listing.filter(f => f.endsWith('.md'))) {
    const lang = localeOf(name), key = pageKey(name)
    const counterpart = key + (lang === 'en' ? '.uk.md' : '.md')
    if (!listing.includes(counterpart)) throw Error(`Missing translation: ${scope}/${counterpart}`)
    const source = `${scope}/${name}`
    const text = await readFile(path.join(sourceRoot, source), 'utf8')
    pages.set(source, { scope, lang, key, text, title: text.match(/^# (.+)/m)?.[1] || key })
    routes.set(source, route(scope, key, lang))
  }
}
for (const lang of Object.keys(locales)) routes.set(lang === 'en' ? 'README.md' : 'README.uk.md', route(current, 'index', lang))
function html(title, body, file, scope, lang, key) {
  const l = locales[lang], generation = metadata.has(scope) ? scope : current, meta = metadata.get(generation)
  const link = target => relative(file, target)
  const nav = [['home', generation, 'index'], ['guide', generation, 'guide'], ['spec', generation, 'spec'], ['resources', generation, 'resources'], ['design', 'design', 'index']]
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Knot Engine</title><script>${themeScript}</script><style>${style}</style></head><body class="shell"><header><div class="header-row"><div class="identity"><a class="brand" href="${link(route(generation, 'index', lang))}">Knot Engine</a> <span class="contract-version">${generation}</span> <span class="package-version">(${esc(meta.packageVersion)})</span></div><div class="header-controls"><nav class="languages" aria-label="${l.language}">${Object.entries(locales).map(([code, locale]) => `<a hreflang="${code}" lang="${code}" ${code === lang ? 'aria-current="page"' : ''} href="${link(route(scope,key,code))}">${locale.name}</a>`).join('')}</nav><button class="theme-toggle" type="button" aria-label="${l.theme}" title="${l.theme}" onclick="window.toggleSiteTheme()"><span class="moon" aria-hidden="true">☾</span><span class="sun" aria-hidden="true">☀</span></button></div></div><p class="intro">${l.intro}</p><nav class="sections">${nav.map(([label,s,k]) => `<a href="${link(route(s,k,lang))}">${l[label]}</a>`).join('')}</nav></header>${scope === 'design' ? `<aside class="notice">${l.proposed}</aside>` : ''}<main class="markdown-body">${body}</main></body></html>`
}
function resolveLink(href, source, file) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) return href
  const [pathname, fragment] = href.split('#')
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(source), pathname))
  let destination = routes.get(target)
  if (!destination && /^(v\d+|design)(\/|$)/.test(target)) destination = target.endsWith('/') ? target + 'index.html' : target
  return (destination ? relative(file, destination) : `https://github.com/yuriyapostol/knot-engine/blob/${commit}/${target}`) + (fragment ? '#' + fragment : '')
}
await rm(output, { recursive: true, force: true })
console.log((await run('npm', ['run', 'build:example'], { env: { ...process.env, BASE_PATH: './' }, maxBuffer: 10 * 1024 * 1024 })).stdout)
for (const scope of [...generations, 'design']) await cp(path.join(sourceRoot, scope), path.join(output, scope), { recursive: true })
await cp('site-runtime-dist', path.join(output, current, '_example'), { recursive: true })
for (const [source, p] of pages) {
  const file = routes.get(source), counts = new Map()
  const marked = new Marked({ renderer: {
    heading({ tokens, depth }) {
      const content = this.parser.parseInline(tokens), base = content.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}_\s-]/gu,'').replace(/\s/g,'-')
      const count = counts.get(base) || 0; counts.set(base,count+1)
      return `<h${depth} id="${esc(base + (count ? '-' + count : ''))}">${content}</h${depth}>`
    },
    link({ href, title, tokens }) { return `<a href="${esc(resolveLink(href,source,file))}"${title ? ` title="${esc(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>` },
    image({ href, text }) { return `<img src="${esc(resolveLink(href,source,file))}" alt="${esc(text)}">` }
  } })
  const example = p.scope === current ? `<iframe class="example" title="${locales[p.lang].example}" src="${relative(file,`${current}/_example/index.html`)}?lang=${p.lang}" loading="lazy"></iframe>` : `<p>${p.lang === 'uk' ? 'Інтерактивний приклад доступний для поточної версії пакету та в її архівах.' : 'The interactive example is available for the current package generation and its archives.'}</p>`
  await put(file, html(p.title, marked.parse(p.text).replaceAll('<!-- interactive-example -->',example),file,p.scope,p.lang,p.key))
}
for (const scope of [...generations, 'design']) {
  for (const lang of Object.keys(locales)) {
    for (const section of scope === 'design' ? ['index'] : ['index','guide','spec','resources']) {
      const file = route(scope,section,lang)
      if ([...routes.values()].includes(file)) continue
      const items = [...pages].filter(([,p]) => p.scope === scope && p.lang === lang && (section === 'index' || p.key.startsWith(section + '/')))
      const title = locales[lang][scope === 'design' ? 'design' : section === 'index' ? 'home' : section]
      await put(file,html(title,`<h1>${title}</h1><ul>${items.map(([s,p]) => `<li><a href="${relative(file,routes.get(s))}">${esc(p.title)}</a></li>`).join('')}</ul>${section === 'spec' ? `<p><a href="${relative(file,route(scope,'spec/schema',lang))}">${locales[lang].schemas}</a> · <a href="${relative(file,route(scope,'spec/examples',lang))}">${locales[lang].examples}</a></p>` : ''}`,file,scope,lang,section))
    }
  }
  if (scope === 'design') continue
  for (const section of ['schema','examples']) {
    const dir = `${scope}/spec/${section}`
    const listing = await files(path.join(sourceRoot,dir))
    const folders = ['', ...new Set(listing.flatMap(f => { const parts = f.split('/'); return parts.slice(0,-1).map((_,i) => parts.slice(0,i+1).join('/')) }))]
    for (const folder of folders) for (const lang of Object.keys(locales)) {
      const key = `spec/${section}${folder ? '/' + folder : ''}`
      const file = route(scope,key,lang), title = locales[lang][section === 'schema' ? 'schemas' : 'examples']
      await put(file,html(title,`<h1>${title}</h1><ul>${listing.filter(f => !folder || f.startsWith(folder + '/')).map(f => `<li><a href="${relative(file,`${dir}/${f}`)}">${esc(f)}</a></li>`).join('')}</ul>`,file,scope,lang,key))
    }
  }
  await cp(path.join(sourceRoot,scope,'spec/schema'),path.join(output,scope,'schema'),{ recursive:true })
  await put(`${scope}/release.json`,JSON.stringify({...metadata.get(scope),commit,sourceDirty},null,2)+'\n')
}
await mkdir(archives,{recursive:true})
await cp(archives,path.join(output,'releases'),{recursive:true})
const releases = (await readdir(archives,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))
const archiveHomes = new Map()
for (const version of releases) for (const lang of Object.keys(locales)) {
  const modern = `releases/${version}/index${lang === 'en' ? '' : '.' + lang}.html`
  try {
    await readFile(path.join(output, modern))
    archiveHomes.set(`${version}/${lang}`, modern)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    archiveHomes.set(`${version}/${lang}`, `releases/${version}/${lang === 'uk' ? 'uk/' : ''}index.html`)
  }
}
for (const lang of Object.keys(locales)) {
  const l=locales[lang], file=route('','index',lang)
  await put(file,html(l.versions,`<h1>Knot Engine</h1><ul>${generations.map(g=>`<li><a href="${relative(file,route(g,'index',lang))}">${g} — ${esc(metadata.get(g).packageVersion)}</a></li>`).join('')}</ul><h2>${l.archives}</h2><ul>${releases.map(v=>`<li><a href="${relative(file,archiveHomes.get(`${v}/${lang}`))}">${esc(v)}</a></li>`).join('')}</ul>${releases.length ? '' : `<p>${l.noArchives}</p>`}`,file,'',lang,'index'))
}
await put('versions.json',JSON.stringify({current:{path:current+'/',version:pkg.version},locales:Object.keys(locales),generations:generations.map(g=>({path:g+'/',...metadata.get(g)})),releases:releases.map(version=>({version,path:`releases/${version}/`}))},null,2)+'\n')
await put('.nojekyll','')
console.log(`Built site: ${generations.join(', ')}; ${pages.size} localized pages; ${releases.length} archives`)
