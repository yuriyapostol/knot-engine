import { createServer } from 'vite'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
const run = promisify(execFile)
const root = process.cwd()
const build = async () => console.log((await run('node', ['scripts/site/build.mjs'], { maxBuffer: 10 * 1024 * 1024 })).stdout)
await build()
const args = process.argv.slice(2)
const port = args.includes('--port') ? Number(args[args.indexOf('--port') + 1]) : 5173
const server = await createServer({ configFile: false, root: path.join(root, 'site-dist'), appType: 'mpa', server: { host: '127.0.0.1', port, strictPort: true } })
await server.listen()
server.printUrls()
server.watcher.add([path.join(root,'v*'), ...['design','site','src','scripts/site','package.json'].map(p=>path.join(root,p))])
// Explicit directories also support watchers without glob expansion.
const { readdir } = await import('node:fs/promises')
for (const e of await readdir(root)) if (/^v\d+$/.test(e)) server.watcher.add(path.join(root,e))
let timer, building = false, pending = false
async function rebuild() {
  if (building) { pending = true; return }
  building = true
  try { await build(); server.ws.send({ type: 'full-reload' }) } catch (error) { console.error(error.stderr || error) }
  finally { building = false; if (pending) { pending = false; await rebuild() } }
}
server.watcher.on('all', (_event, file) => {
  const name = path.relative(root,file).replaceAll(path.sep,'/')
  if (!/^(v\d+\/|design\/|site\/|src\/|scripts\/site\/|package\.json$)/.test(name)) return
  clearTimeout(timer); timer = setTimeout(rebuild,200)
})
