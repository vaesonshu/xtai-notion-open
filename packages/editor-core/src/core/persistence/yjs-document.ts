import { TiptapTransformer } from "@hocuspocus/transformer"
import { getSchema } from "@tiptap/core"
import { Node as PMNode } from "@tiptap/pm/model"
import * as Y from "yjs"
import type { Block, InlineContent, TableContent } from "../model/types"
import { blocksToPmDoc, pmDocToBlocks } from "../api/conversions/pm-doc"
import { createStarterBlocks } from "../model/documents"
import { generateBlockId } from "../model/ids"
import { createEditorExtensions } from "../extensions"
import {
  CURRENT_SCHEMA_VERSION,
  writeYDocSchemaVersion,
} from "./migrate/migrate-ydoc"

/** 判断 fromYdoc 结果是否为块 schema（根下第一层为 blockGroup） */
function isBlockSchemaJson(json: { content?: { type?: string }[] }): boolean {
  return json.content?.[0]?.type === "blockGroup"
}

function yDocToBlockSchemaJson(yDoc: Y.Doc): {
  type?: string
  content?: { type?: string }[]
} {
  const extensions = createEditorExtensions()
  return TiptapTransformer.extensions(extensions).fromYdoc(yDoc, "default") as {
    type?: string
    content?: { type?: string }[]
  }
}

/** 将已加载的 Yjs 文档快照转为 Block[]，供只读渲染或公开 API 使用。 */
export function documentFromYjs(yDoc: Y.Doc): Block[] {
  const json = yDocToBlockSchemaJson(yDoc)

  if (!isBlockSchemaJson(json)) {
    throw new Error(
      "Unsupported Yjs document shape: expected block schema v2 (doc > blockGroup)"
    )
  }

  const extensions = createEditorExtensions()
  const schema = getSchema(extensions)
  const pmDoc = PMNode.fromJSON(schema, json)
  return pmDocToBlocks(pmDoc)
}

/** 读取 Yjs 内容；尚未持久化块 schema 时返回空白 starter（新建文档常见）。 */
export function documentFromYjsOrStarter(yDoc: Y.Doc): Block[] {
  const json = yDocToBlockSchemaJson(yDoc)
  if (!isBlockSchemaJson(json)) {
    return createStarterBlocks()
  }
  const extensions = createEditorExtensions()
  const schema = getSchema(extensions)
  const pmDoc = PMNode.fromJSON(schema, json)
  return pmDocToBlocks(pmDoc)
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
  const schema = getSchema(extensions)
  const json = blocksToPmDoc(blocks ?? createStarterBlocks(), schema).toJSON()
  const yDoc = TiptapTransformer.extensions(extensions).toYdoc(json, "default")
  writeYDocSchemaVersion(yDoc, CURRENT_SCHEMA_VERSION)
  return yDoc
}

/** 在 Tiptap XmlFragment 树中找到第一段可插入的 Y.XmlText */
function findFirstXmlText(parent: Y.XmlFragment): Y.XmlText | null {
  for (const child of parent.toArray()) {
    if (child instanceof Y.XmlText) {
      return child
    }
    if (child instanceof Y.XmlElement) {
      const nested = findFirstXmlText(child)
      if (nested) {
        return nested
      }
    }
  }
  return null
}

/** 将 Block[] 写回已有块 schema Y.Doc（仅用于空文档初始化，避免跨客户端整树替换） */
function writeBlocksToBlockSchemaYDoc(yDoc: Y.Doc, blocks: Block[]): void {
  const extensions = createEditorExtensions()
  const schema = getSchema(extensions)
  const json = blocksToPmDoc(blocks, schema).toJSON()
  const next = TiptapTransformer.extensions(extensions).toYdoc(json, "default")
  Y.applyUpdate(yDoc, Y.encodeStateAsUpdate(next))
  next.destroy()
  writeYDocSchemaVersion(yDoc, CURRENT_SCHEMA_VERSION)
}

function appendTextToBlocks(blocks: Block[], text: string): void {
  const visit = (items: Block[]): boolean => {
    for (const block of items) {
      if (Array.isArray(block.content)) {
        const textNode = block.content.find((item) => item.type === "text")
        if (textNode && textNode.type === "text") {
          textNode.text += text
          return true
        }
        if (block.type === "paragraph") {
          block.content = [{ type: "text", text, styles: {} }]
          return true
        }
      }
      if (visit(block.children)) {
        return true
      }
    }
    return false
  }

  if (!visit(blocks)) {
    blocks.push({
      id: generateBlockId(),
      type: "paragraph",
      props: {},
      content: [{ type: "text", text, styles: {} }],
      children: [],
    })
  }
}

/** 在已有块 schema Y.Doc 中追加纯文本（协作安全：优先原地插入 XmlText） */
export function appendTextToBlockSchemaYDoc(yDoc: Y.Doc, text: string): void {
  const fragment = yDoc.getXmlFragment("default")
  const xmlText = findFirstXmlText(fragment)
  if (xmlText) {
    xmlText.insert(xmlText.length, text)
    return
  }

  const blocks = documentFromYjs(yDoc)
  appendTextToBlocks(blocks, text)
  writeBlocksToBlockSchemaYDoc(yDoc, blocks)
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

/** merge 时作为 Y.applyUpdate origin，供 Host 忽略自身写入、避免误标 stale */
export const AI_WRITE_MERGE_ORIGIN = { type: "ai-write-merge" } as const

/** 克隆 shared Y.Doc 为独立 fork，AI 写入仅作用于 fork，不污染协作文档 */
export function forkYDoc(shared: Y.Doc): Y.Doc {
  const fork = new Y.Doc()
  Y.applyUpdate(fork, Y.encodeStateAsUpdate(shared))
  return fork
}

/** 将 fork 相对 shared 的增量更新合并回 shared（Accept 时调用） */
export function mergeForkInto(shared: Y.Doc, fork: Y.Doc): void {
  const update = Y.encodeStateAsUpdate(fork, Y.encodeStateVector(shared))
  Y.applyUpdate(shared, update, AI_WRITE_MERGE_ORIGIN)
}
