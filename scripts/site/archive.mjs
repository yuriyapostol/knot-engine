import path from 'node:path'
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
if (!/^\d+\.\d+\.\d+(?:-[\da-zA-Z.-]+)?$/.test(pkg.version)) throw new Error('Invalid release version')
const destination = `${process.env.SITE_ARCHIVES_DIR || 'site/releases'}/${pkg.version}`
try { await access(destination); throw new Error(`Archive already exists: ${destination}`) } catch (e) { if (e.code !== 'ENOENT') throw e }
console.log((await run('npm', ['run', 'build:site'], { maxBuffer: 10 * 1024 * 1024 })).stdout)
await mkdir(destination, { recursive: true })
await cp(`${process.env.SITE_OUTPUT_DIR || 'site-dist'}/${pkg.knotEngine.resourceDirectory}`, destination, { recursive: true })
const metadata = JSON.parse(await readFile(`${destination}/release.json`, 'utf8'))
metadata.status = 'release'
await writeFile(`${destination}/release.json`, JSON.stringify(metadata, null, 2) + '\n')
// Preserve links to the site root and other generations from the deeper archive path.
const { readdir } = await import('node:fs/promises')
async function fixNavigation(dir) {
 for (const entry of await readdir(dir, { withFileTypes: true })) {
  const file = `${dir}/${entry.name}`
  if (entry.isDirectory()) await fixNavigation(file)
  else if (entry.name.endsWith('.html')) {
   const text = await readFile(file, 'utf8')
   const page = path.relative(destination, file).split(path.sep).join('/')
   const updated = text.replace(/(href|src)="([^"#]+)(#[^"]*)?"/g, (match, attribute, href, fragment = '') => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return match
    const target = path.posix.normalize(path.posix.join(pkg.knotEngine.resourceDirectory, path.posix.dirname(page), href))
    if (target.startsWith(pkg.knotEngine.resourceDirectory + '/')) return match
    const rewritten = path.posix.relative(path.posix.dirname(`releases/${pkg.version}/${page}`), target)
    return `${attribute}="${rewritten}${fragment}"`
   })
   await writeFile(file, updated)
  }
 }
}
await fixNavigation(destination)
console.log(`Created ${destination}. Review and commit the snapshot with the release; rebuild the site to include it.`)
