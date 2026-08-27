import fs from "node:fs"
import path from "node:path"

/**
 * 校验 editor SDK 三包之间的依赖方向：
 * core → 无 react / 无上层包
 * react → 可依赖 core，不可依赖 shadcn / workspace UI
 * shadcn → 可依赖 core + react，不可依赖 workspace UI
 */
const ROOT = process.cwd()

const PACKAGE_RULES = {
  "packages/editor-core": {
    label: "@xtai-notion/editor-core",
    forbidden: [
      "@xtai-notion/editor-react",
      "@xtai-notion/editor-shadcn",
      "@workspace/ui",
      "@workspace/icons",
      "@workspace/editor",
      "react",
      "react-dom",
    ],
  },
  "packages/editor-react": {
    label: "@xtai-notion/editor-react",
    forbidden: [
      "@xtai-notion/editor-shadcn",
      "@workspace/ui",
      "@workspace/icons",
      "@workspace/editor",
    ],
  },
  "packages/editor-shadcn": {
    label: "@xtai-notion/editor-shadcn",
    forbidden: ["@workspace/ui", "@workspace/icons", "@workspace/editor"],
  },
}

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']|require\(["']([^"']+)["']\)/g

function collectSourceFiles(dir) {
  const results = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      results.push(...collectSourceFiles(full))
    } else if (/\.(tsx?|jsx?|mts|cts)$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

function moduleMatchesForbidden(specifier, forbidden) {
  return forbidden.some(
    (pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`)
  )
}

function checkPackage(relativeDir, { label, forbidden }) {
  const absDir = path.join(ROOT, relativeDir)
  const srcDir = path.join(absDir, "src")
  const violations = []

  for (const file of collectSourceFiles(srcDir)) {
    const content = fs.readFileSync(file, "utf8")
    let match
    IMPORT_RE.lastIndex = 0
    while ((match = IMPORT_RE.exec(content)) !== null) {
      const specifier = match[1] ?? match[2]
      if (!specifier || !moduleMatchesForbidden(specifier, forbidden)) continue
      violations.push({
        file: path.relative(ROOT, file),
        specifier,
      })
    }
  }

  return { label, relativeDir, violations }
}

function main() {
  let failed = false

  for (const [relativeDir, rule] of Object.entries(PACKAGE_RULES)) {
    const { label, violations } = checkPackage(relativeDir, rule)
    if (violations.length === 0) {
      console.log(`OK  ${label}`)
      continue
    }

    failed = true
    console.error(`FAIL ${label} (${violations.length} violation(s))`)
    for (const v of violations) {
      console.error(`  ${v.file}: forbidden import "${v.specifier}"`)
    }
  }

  if (failed) {
    process.exitCode = 1
    console.error("\nEditor SDK boundary check failed.")
  } else {
    console.log("\nEditor SDK boundary check passed.")
  }
}

main()
