/**
 * Fail the build if dist/index.html references JS/CSS files that are missing from dist/.
 * Catches broken deploy artifacts before Render publishes an inconsistent bundle.
 */
import fs from 'node:fs'
import path from 'node:path'

const clientRoot = path.resolve(import.meta.dirname, '..')
const distDir = path.join(clientRoot, 'dist')
const indexPath = path.join(distDir, 'index.html')

if (!fs.existsSync(indexPath)) {
  console.error('[verify-dist] Missing dist/index.html — run vite build first.')
  process.exit(1)
}

const html = fs.readFileSync(indexPath, 'utf8')
const assetRefs = [
  ...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g),
].map((m) => m[1])

if (assetRefs.length === 0) {
  console.error('[verify-dist] dist/index.html has no /assets/ references.')
  process.exit(1)
}

const missing = assetRefs.filter((ref) => {
  const rel = ref.replace(/^\//, '')
  return !fs.existsSync(path.join(distDir, rel))
})

if (missing.length > 0) {
  console.error('[verify-dist] dist/index.html references files that are not in dist/:')
  for (const m of missing) console.error(`  - ${m}`)
  process.exit(1)
}

console.log(`[verify-dist] OK — ${assetRefs.length} asset reference(s) verified.`)
