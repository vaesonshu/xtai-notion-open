import type { JSONContent } from "@tiptap/core"
import { TiptapTransformer } from "@hocuspocus/transformer"
import type * as Y from "yjs"
import { createEditorExtensions } from "./extensions"
import type { EditorDocument } from "./types"

function nodeText(node: JSONContent): string {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  const children = Array.isArray(node.content)
    ? node.content.map((child) => nodeText(child)).join("")
    : ""
  return node.type === "doc" ? children : `${children}\n`
}

/** 将已加载的 Yjs 文档快照转为 TipTap JSON，供只读渲染或公开 API 使用。 */
export function documentFromYjs(yDoc: Y.Doc): EditorDocument {
  const json = TiptapTransformer.extensions(createEditorExtensions()).fromYdoc(
    yDoc,
    "default"
  )
  return json as EditorDocument
}

/** 从 TipTap JSON 提取纯文本，用于摘要或搜索预览。 */
export function documentToPlainText(document: EditorDocument): string {
  return nodeText(document).trim()
}
