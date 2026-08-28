import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// editor-core 必须保持无 React 边界，避免 API 等服务端包误拉 UI 依赖
const FORBIDDEN = /from\s+["'](react|react-dom|@tiptap\/react|@workspace\/ui)/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === "node_modules") return []
      return walk(path)
    }
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")
      ? [path]
      : []
  })
}

describe("editor-core react boundary", () => {
  it("does not import react, tiptap/react, or workspace ui", () => {
    const srcRoot = join(__dirname, "../../src/core")
    const files = walk(srcRoot)
    const violations = files.flatMap((file) => {
      const text = readFileSync(file, "utf8")
      return FORBIDDEN.test(text) ? [file] : []
    })
    expect(violations).toEqual([])
  })
})
