import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('docs')
const html = await readFile(path.join(output, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(path.join(output, 'manifest.webmanifest'), 'utf8'))
const worker = await readFile(path.join(output, 'sw.js'), 'utf8')

assert.match(html, /href="\.\/manifest\.webmanifest"/)
assert.match(html, /href="\.\/icons\/icon-180\.png"/)
assert.match(html, /src="\.\/assets\//)
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.start_url, './')
assert.equal(manifest.scope, './')

const filesLine = worker.match(/^const FILES = (.+)$/m)
assert.ok(filesLine, 'Precache list is missing')
const files = JSON.parse(filesLine[1])
assert.ok(files.includes('./index.html'))
assert.ok(files.includes('./images/base-room-photo-v2.jpeg'))
assert.ok(files.some(file => file.endsWith('.js') && file.startsWith('./assets/')))
assert.ok(files.some(file => file.endsWith('.css') && file.startsWith('./assets/')))

for (const file of files) {
  const asset = path.resolve(output, file)
  assert.ok(asset.startsWith(`${output}${path.sep}`), `Unsafe asset path: ${file}`)
  assert.ok((await stat(asset)).isFile(), `Missing precache asset: ${file}`)
}

for (const size of [180, 192, 512]) assert.ok((await stat(path.join(output, `icons/icon-${size}.png`))).isFile())
assert.match(worker, /self\.addEventListener\('install'/)
assert.match(worker, /self\.addEventListener\('fetch'/)
console.log(`PASS: GitHub subpath links, manifest, icons, ${files.length} precached assets and offline worker`)
