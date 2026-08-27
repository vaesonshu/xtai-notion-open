import fs from "node:fs"
import path from "node:path"

const root = path.resolve("packages/editor-shadcn/src")

/** 按文件深度计算指向 ui/icons 的相对路径前缀。 */
function uiPrefix(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/")
  const depth = rel.split("/").length - 1
  return "../".repeat(depth) + "ui"
}

function iconsPrefix(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/")
  const depth = rel.split("/").length - 1
  return "../".repeat(depth) + "icons"
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8")
  const ui = uiPrefix(filePath)
  const icons = iconsPrefix(filePath)

  content = content.replace(
    /from "@workspace\/ui\/components\/([^"]+)"/g,
    `from "${ui}/$1"`
  )
  content = content.replace(/from "@workspace\/icons"/g, `from "${icons}"`)
  content = content.replace(
    /from "\.\.\/\.\.\/react\/hooks\/([^"]+)"/g,
    'from "@xtai-notion/editor-react"'
  )
  content = content.replace(
    /from "\.\.\/react\/hooks\/([^"]+)"/g,
    'from "@xtai-notion/editor-react"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/react\/providers\/([^"]+)"/g,
    'from "@xtai-notion/editor-react"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/react\/context\/([^"]+)"/g,
    'from "@xtai-notion/editor-react"'
  )
  content = content.replace(
    /from "\.\.\/react\/context\/([^"]+)"/g,
    'from "@xtai-notion/editor-react"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/react\/editor-content"/g,
    'from "@xtai-notion/editor-react"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/types"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/image-upload"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/canvas\/canvas-files"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/canvas\/canvas-export"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/canvas\/canvas-snapshot"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/slash-commands"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/table"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/mention"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/commands"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/extensions\/canvas-block-node"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/core\/extensions\/image-upload-node"/g,
    'from "@xtai-notion/editor-core"'
  )
  content = content.replace(
    /from "\.\.\/\.\.\/collaboration\/([^"]+)"/g,
    'from "@xtai-notion/editor-react/collaboration"'
  )

  fs.writeFileSync(filePath, content, "utf8")
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      migrateFile(full)
    }
  }
}

walk(path.join(root, "components"))
console.log("Migrated editor-shadcn component imports.")
