import { TiptapTransformer } from "@hocuspocus/transformer"
import { Editor } from "@tiptap/core"
import type * as Y from "yjs"
import { pmDocToBlocks } from "./block-schema/convert"
import type { Block, InlineContent, TableContent } from "./block-schema/types"
import { createEditorExtensions } from "./extensions"
import { legacyJsonToBlocks } from "./migrate/legacy-json-to-blocks"

/** 判断 fromYdoc 结果是否为块 schema（根下第一层为 blockGroup） */
function isBlockSchemaJson(json: { content?: { type?: string }[] }): boolean {
  return json.content?.[0]?.type === "blockGroup"
}

/** 将已加载的 Yjs 文档快照转为 Block[]，供只读渲染或公开 API 使用。 */
export function documentFromYjs(yDoc: Y.Doc): Block[] {
  const extensions = createEditorExtensions()
  const json = TiptapTransformer.extensions(extensions).fromYdoc(
    yDoc,
    "default"
  ) as { type?: string; content?: { type?: string }[] }

  // 新块 schema：经 PM 再 pmDocToBlocks，保证与编辑器内块树一致
  if (isBlockSchemaJson(json)) {
    const editor = new Editor({ extensions, content: json })
    const blocks = pmDocToBlocks(editor.state.doc)
    editor.destroy()
    return blocks
  }

  // 旧 doc > paragraph 结构：纯 JSON 迁移兜底
  return legacyJsonToBlocks(json)
}

/** 递归提取行内纯文本（mention 用 label 表示） */
function inlineToPlainText(content: InlineContent[]): string {
  let text = ""
  for (const item of content) {
    if (item.type === "text") {
      text += item.text
    } else if (item.type === "mention") {
      text += item.label || item.id
    } else if (item.type === "link") {
      text += inlineToPlainText(item.content)
    }
  }
  return text
}

/** 从 Block[] 提取纯文本，用于摘要或搜索预览。 */
export function documentToPlainText(blocks: Block[]): string {
  const parts: string[] = []

  const visit = (items: Block[]) => {
    for (const block of items) {
      if (Array.isArray(block.content)) {
        const text = inlineToPlainText(block.content)
        if (text) {
          parts.push(text)
        }
      } else if (block.content && "rows" in block.content) {
        const table = block.content as TableContent
        for (const row of table.rows) {
          for (const cell of row.cells) {
            const cellText = inlineToPlainText(cell.content)
            if (cellText) {
              parts.push(cellText)
            }
          }
        }
      }
      visit(block.children)
    }
  }

  visit(blocks)
  return parts.join("\n").trim()
}
