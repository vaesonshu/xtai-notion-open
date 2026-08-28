import { TiptapTransformer } from "@hocuspocus/transformer"
import { Editor } from "@tiptap/core"
import type * as Y from "yjs"
import type { Block, InlineContent, TableContent } from "./block-schema/types"
import { blocksToPmDoc, pmDocToBlocks } from "./block-schema/convert"
import { createStarterBlocks } from "./block-schema/documents"
import { createEditorExtensions } from "./extensions"
import { legacyJsonToBlocks } from "./migrate/legacy-json-to-blocks"
import {
  CURRENT_SCHEMA_VERSION,
  writeYDocSchemaVersion,
} from "./migrate/migrate-ydoc"

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

/** 用块 schema v2 初始化协作 Y.Doc（default XmlFragment + schemaVersion=2） */
export function createBlockSchemaYDoc(blocks?: Block[]): Y.Doc {
  const extensions = createEditorExtensions()
  const editor = new Editor({ extensions })
  const json = blocksToPmDoc(
    blocks ?? createStarterBlocks(),
    editor.schema
  ).toJSON()
  editor.destroy()

  const yDoc = TiptapTransformer.extensions(extensions).toYdoc(json, "default")
  writeYDocSchemaVersion(yDoc, CURRENT_SCHEMA_VERSION)
  return yDoc
}

/** 在已有块 schema Y.Doc 末尾插入纯文本（供协作集成测试使用） */
export function appendTextToBlockSchemaYDoc(yDoc: Y.Doc, text: string): void {
  const extensions = createEditorExtensions({ document: yDoc })
  const editor = new Editor({ extensions })
  editor.chain().focus("end").insertContent(text).run()
  editor.destroy()
}

/** 判断 Y.Doc 的 default fragment 是否已有块内容 */
export function blockSchemaYDocHasContent(yDoc: Y.Doc): boolean {
  return documentFromYjs(yDoc).some((block) => {
    if (Array.isArray(block.content)) {
      return block.content.some(
        (item) => item.type === "text" && item.text.trim().length > 0
      )
    }
    if (block.content && "rows" in block.content) {
      const table = block.content as TableContent
      return table.rows.some((row) =>
        row.cells.some((cell) =>
          cell.content.some(
            (item) => item.type === "text" && item.text.trim().length > 0
          )
        )
      )
    }
    return block.children.length > 0
  })
}
