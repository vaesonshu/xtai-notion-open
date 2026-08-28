/**
 * 将 co-located 测试文件迁移到各包的 test/ 目录，并重写相对导入。
 * 用法：node scripts/move-tests-to-test-dir.mjs [--dry-run]
 */
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const ROOT = process.cwd()
const DRY_RUN = process.argv.includes("--dry-run")

/** @type {Array<{ packageRoot: string; srcDir: string; testDir: string; globs: string[]; alias: string; aliasTarget: string }>} */
const TARGETS = [
  {
    packageRoot: "packages/editor-core",
    srcDir: "src/core",
    testDir: "test/core",
    globs: ["**/*.test.ts"],
    alias: "@core",
    aliasTarget: "src/core",
  },
  {
    packageRoot: "packages/editor-react",
    srcDir: "src",
    testDir: "test",
    globs: ["**/*.test.ts", "**/*.test.tsx"],
    alias: "@react-src",
    aliasTarget: "src",
  },
  {
    packageRoot: "packages/editor-shadcn",
    srcDir: "src",
    testDir: "test",
    globs: ["**/*.test.ts", "**/*.test.tsx"],
    alias: "@shadcn-src",
    aliasTarget: "src",
  },
  {
    packageRoot: "packages/icons",
    srcDir: "src",
    testDir: "test",
    globs: ["**/*.test.ts"],
    alias: "@icons-src",
    aliasTarget: "src",
  },
  {
    packageRoot: "apps/web",
    srcDir: ".",
    testDir: "test",
    globs: ["**/*.test.ts", "**/*.test.tsx"],
    alias: "@/",
    aliasTarget: ".",
  },
  {
    packageRoot: "apps/api",
    srcDir: "src",
    testDir: "test",
    globs: ["**/*.spec.ts"],
    alias: "@api",
    aliasTarget: "src",
  },
]

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g
const MOCK_RE = /vi\.mock\(\s*["']([^"']+)["']/g

function walk(dir, matcher) {
  const results = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "test" ||
        entry.name === "e2e" ||
        entry.name === ".next"
      ) {
        continue
      }
      results.push(...walk(full, matcher))
    } else if (matcher(entry.name)) {
      results.push(full)
    }
  }
  return results
}

function isTestFile(name, globs) {
  return globs.some((g) => {
    if (g === "**/*.test.ts") return name.endsWith(".test.ts")
    if (g === "**/*.test.tsx") return name.endsWith(".test.tsx")
    if (g === "**/*.spec.ts") return name.endsWith(".spec.ts")
    return false
  })
}

function toPosix(p) {
  return p.split(path.sep).join("/")
}

function rewriteRelativeImport(oldFile, importPath, srcAbs, alias) {
  if (!importPath.startsWith(".")) return importPath

  const oldDir = path.dirname(oldFile)
  let resolved = path.normalize(path.join(oldDir, importPath))

  // web：相对导入指向 apps/web 下的源文件
  if (alias === "@/") {
    const webRoot = srcAbs
    if (resolved.startsWith(webRoot)) {
      const rel = toPosix(path.relative(webRoot, resolved))
      return `@/${rel}`
    }
    return importPath
  }

  if (!resolved.startsWith(srcAbs)) {
    return importPath
  }

  const rel = toPosix(path.relative(srcAbs, resolved))
  if (alias === "@/") return `@/${rel}`
  return `${alias}/${rel}`
}

function rewriteFileImports(content, oldFile, srcAbs, alias, pkgAbs) {
  const rewriteTarget = alias === "@/" ? pkgAbs : srcAbs
  let next = content.replace(IMPORT_RE, (match, spec1, spec2) => {
    const spec = spec1 ?? spec2
    if (!spec?.startsWith(".")) return match
    const rewritten = rewriteRelativeImport(oldFile, spec, rewriteTarget, alias)
    if (rewritten === spec) return match
    return match.replace(spec, rewritten)
  })
  next = next.replace(MOCK_RE, (match, spec) => {
    if (!spec.startsWith(".")) return match
    const rewritten = rewriteRelativeImport(oldFile, spec, rewriteTarget, alias)
    if (rewritten === spec) return match
    return match.replace(spec, rewritten)
  })
  return next
}

function fixShadcnTestUtilsPath(content, newFile) {
  // test/components/... → test/editor-test-utils
  const depth = toPosix(path.relative("test", path.dirname(newFile))).split("/")
    .length
  const prefix = "../".repeat(depth)
  return content.replace(
    /from ["']\.\.\/\.\.\/\.\.\/test\/editor-test-utils["']/g,
    `from "${prefix}editor-test-utils"`
  )
}

function gitMv(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  if (DRY_RUN) {
    console.log(`mv ${from} -> ${to}`)
    return
  }
  execSync(`git mv "${from}" "${to}"`, { cwd: ROOT, stdio: "inherit" })
}

function main() {
  let moved = 0

  for (const target of TARGETS) {
    const pkgAbs = path.join(ROOT, target.packageRoot)
    const srcAbs = path.join(pkgAbs, target.srcDir)
    const testAbs = path.join(pkgAbs, target.testDir)

    const files = walk(srcAbs, (name) => isTestFile(name, target.globs))

    for (const file of files) {
      const relFromSrc = path.relative(srcAbs, file)
      const dest = path.join(testAbs, relFromSrc)

      if (fs.existsSync(dest)) {
        console.warn(`skip (exists): ${dest}`)
        continue
      }

      let content = fs.readFileSync(file, "utf8")
      content = rewriteFileImports(
        content,
        file,
        srcAbs,
        target.alias,
        pkgAbs
      )

      if (target.packageRoot === "packages/editor-shadcn") {
        content = fixShadcnTestUtilsPath(content, dest)
      }

      if (DRY_RUN) {
        console.log(`mv ${file} -> ${dest}`)
        moved++
        continue
      }

      gitMv(file, dest)
      fs.writeFileSync(dest, content, "utf8")
      moved++
    }
  }

  console.log(`\n${DRY_RUN ? "Would move" : "Moved"} ${moved} test file(s).`)
}

main()
