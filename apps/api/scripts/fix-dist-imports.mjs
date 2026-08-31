import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist")

// Node ESM 要求相对 import 带 .js；tsc ESNext 产物默认不带，Vercel 上会 MODULE_NOT_FOUND。
const relativeImport =
  /(\bfrom\s+["']|import\s*\(\s*["']|export\s+[^"']*?\s+from\s+["'])(\.\.?\/[^"']+)(["'])/g

function addJsExtension(specifier) {
  if (
    specifier.endsWith(".js") ||
    specifier.endsWith(".json") ||
    specifier.endsWith(".node")
  ) {
    return specifier
  }
  return `${specifier}.js`
}

async function fixFile(filePath) {
  const source = await readFile(filePath, "utf8")
  const fixed = source.replace(
    relativeImport,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${addJsExtension(specifier)}${suffix}`
  )
  if (fixed !== source) {
    await writeFile(filePath, fixed)
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(entryPath)
      continue
    }
    if (entry.name.endsWith(".js")) {
      await fixFile(entryPath)
    }
  }
}

await walk(distDir)
