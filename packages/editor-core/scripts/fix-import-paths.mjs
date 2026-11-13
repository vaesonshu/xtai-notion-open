import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../..", "..")
const dirs = [
  "packages/editor-core",
  "packages/editor-react",
  "packages/editor-shadcn",
  "apps/web",
]
const exts = new Set([".ts", ".tsx"])
const reps = [
  ["@core/block-editor", "@core/editor/block-editor"],
  ["@core/block-schema/convert", "@core/api/conversions/pm-doc"],
  ["@core/block-schema/documents", "@core/model/documents"],
  ["@core/block-schema/ids", "@core/model/ids"],
  ["@core/block-schema/types", "@core/model/types"],
  [
    "@core/block-schema/table-paste",
    "@core/api/clipboard/fromClipboard/tableBlockPaste",
  ],
  ["@core/slash-commands/index", "@core/features/slash"],
  ["@core/slash-commands", "@core/features/slash"],
  ["@core/yjs-document", "@core/persistence/yjs-document"],
  ["@core/migrate/migrate-ydoc", "@core/persistence/migrate/migrate-ydoc"],
  [
    "@core/markdown/paste",
    "@core/api/clipboard/fromClipboard/handleMarkdownPaste",
  ],
  [
    "@xtai-notion/editor-core/block-schema/types",
    "@xtai-notion/editor-core/model/types",
  ],
  [
    "@xtai-notion/editor-core/block-schema/ids",
    "@xtai-notion/editor-core/model/ids",
  ],
  [
    "@xtai-notion/editor-core/block-schema/documents",
    "@xtai-notion/editor-core/model/documents",
  ],
  [
    "@xtai-notion/editor-core/block-schema/convert",
    "@xtai-notion/editor-core/api/conversions/pm-doc",
  ],
  [
    "@xtai-notion/editor-core/slash-commands",
    "@xtai-notion/editor-core/features/slash",
  ],
]

let updated = 0

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(ent.name)) continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      walk(full)
      continue
    }
    if (!exts.has(path.extname(ent.name))) continue
    const before = fs.readFileSync(full, "utf8")
    let next = before
    for (const [from, to] of reps) {
      next = next.split(from).join(to)
    }
    if (next !== before) {
      fs.writeFileSync(full, next)
      updated += 1
    }
  }
}

for (const rel of dirs) {
  walk(path.join(root, rel))
}

console.log(`updated ${updated} files`)
