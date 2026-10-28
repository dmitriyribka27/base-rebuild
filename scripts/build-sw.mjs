import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('docs')
const template = await readFile('scripts/sw-template.js', 'utf8')

async function walk(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative))
    if (entry.isFile()) files.push(relative)
  }
  return files
}

const excluded = new Set(['.nojekyll', 'sw.js', 'images/base-room-v1.png', 'images/dmitriy-avatar-v1.png'])
const files = (await walk(output)).filter(file => !excluded.has(file)).sort()
const hash = createHash('sha256')
for (const file of files) {
  hash.update(file)
  hash.update(await readFile(path.join(output, file)))
}

const version = hash.digest('hex').slice(0, 16)
const cacheName = `base-rebuild-${version}`
const result = template
  .replace('__BASE_CACHE_NAME__', JSON.stringify(cacheName))
  .replace('__BASE_PRECACHE_FILES__', JSON.stringify(files.map(file => `./${file}`)))

await writeFile(path.join(output, 'sw.js'), result)
console.log(`Offline bundle: ${cacheName}, ${files.length} files`)
