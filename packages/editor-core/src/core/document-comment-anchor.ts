import { isTextSelection } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"
import type { BlockEditor } from "./block-editor"

/** 选区评论锚点：块 id + 块内 plain text 字符偏移 */
export type CommentTextAnchor = {
  blockId: string
  anchorFrom: number
  anchorTo: number
  preview: string
}

export type DocumentCommentMarkEntry = {
  id: string
  blockId: string
  anchorFrom: number | null
  anchorTo: number | null
}

/** 解析 pos 所在的 blockContainer id */
export function findBlockContainerIdAt(
  state: EditorState,
  pos: number
): string | null {
  const $pos = state.doc.resolve(pos)
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth)
    if (node.type.name === "blockContainer") {
      return node.attrs.id as string
    }
  }
  return null
}

/** 块内正文（首个 textblock 子节点）在文档中的文本区间 */
export function getBlockTextContentRange(
  doc: PMNode,
  blockId: string
): { from: number; to: number; textLength: number } | null {
  let found: { from: number; to: number; textLength: number } | null = null

  doc.descendants((node, pos) => {
    if (node.type.name !== "blockContainer") return
    if (node.attrs.id !== blockId) return
    if (node.childCount === 0) {
      found = null
      return false
    }

    const content = node.firstChild
    if (!content?.isTextblock) {
      found = null
      return false
    }

    const contentPos = pos + 1
    const innerFrom = contentPos + 1
    const innerTo = contentPos + content.nodeSize - 1
    found = {
      from: innerFrom,
      to: innerTo,
      textLength: content.textContent.length,
    }
    return false
  })

  return found
}

/** 将块内偏移还原为文档选区，供 PM inline 装饰使用 */
export function resolveCommentAnchorInDoc(
  doc: PMNode,
  blockId: string,
  anchorFrom: number,
  anchorTo: number
): { from: number; to: number } | null {
  const range = getBlockTextContentRange(doc, blockId)
  if (!range) return null

  const from = range.from + anchorFrom
  const to = range.from + anchorTo
  if (
    anchorFrom < 0 ||
    anchorTo <= anchorFrom ||
    anchorTo > range.textLength ||
    from >= to
  ) {
    return null
  }

  return { from, to }
}

/** 非空文本选区且落在单个块内时返回评论锚点 */
export function getCommentTextSelection(
  blockEditor: BlockEditor
): CommentTextAnchor | null {
  const { state } = blockEditor.tiptap
  const { selection } = state

  if (selection.empty || !isTextSelection(selection)) {
    return null
  }

  const { from, to } = selection
  const preview = state.doc.textBetween(from, to)
  if (!preview.trim()) {
    return null
  }

  const blockFrom = findBlockContainerIdAt(state, from)
  const blockTo = findBlockContainerIdAt(state, to)
  if (!blockFrom || !blockTo || blockFrom !== blockTo) {
    return null
  }

  const contentRange = getBlockTextContentRange(state.doc, blockFrom)
  if (!contentRange) {
    return null
  }

  const anchorFrom = from - contentRange.from
  const anchorTo = to - contentRange.from
  if (
    anchorFrom < 0 ||
    anchorTo <= anchorFrom ||
    anchorTo > contentRange.textLength
  ) {
    return null
  }

  return {
    blockId: blockFrom,
    anchorFrom,
    anchorTo,
    preview,
  }
}

/** 点击位置是否落在某条评论锚定的选区内 */
export function findCommentMarkAtPos(
  doc: PMNode,
  marks: readonly DocumentCommentMarkEntry[],
  pos: number
): DocumentCommentMarkEntry | null {
  for (const mark of marks) {
    if (mark.anchorFrom == null || mark.anchorTo == null) {
      continue
    }
    const range = resolveCommentAnchorInDoc(
      doc,
      mark.blockId,
      mark.anchorFrom,
      mark.anchorTo
    )
    if (range && pos >= range.from && pos <= range.to) {
      return mark
    }
  }
  return null
}
