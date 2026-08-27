import fs from "node:fs"
import path from "node:path"

const root = path.resolve("apps/web")

const replacements = [
  ['@workspace/editor/styles.css', '@xtai-notion/editor-shadcn/style.css'],
  ['@workspace/editor/collaboration', '@xtai-notion/editor-react/collaboration'],
  ['@workspace/editor/components', '@xtai-notion/editor-shadcn'],
  ['@workspace/editor/react', '@xtai-notion/editor-react'],
  ['@workspace/editor/core', '@xtai-notion/editor-core'],
  ['@workspace/editor', '@xtai-notion/editor-core'],
]

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8")
  let changed = false
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, "utf8")
    console.log("Updated", path.relative(root, filePath))
  }
}

function walk(dir) {
  if (path.basename(dir) === ".next" || path.basename(dir) === "node_modules") {
    return
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      migrateFile(full)
    }
  }
}

walk(root)
console.log("Done migrating apps/web editor imports.")
