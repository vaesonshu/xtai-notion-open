import type { EditorView } from "@tiptap/pm/view"
import { documentToPlainText } from "../yjs-document"
import { isBlockArray } from "./documents"
import type { Block } from "./types"

/** 判断当前选区是否位于表格单元格（含表头单元格）内 */
export function isSelectionInTableCell(view: EditorView): boolean {
  const { $from } = view.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if (name === "tableCell" || name === "tableHeader") {
      return true
    }
  }
  return false
}

/** 尝试将剪贴板 plain text 解析为 Block[]（仅接受 JSON 数组形态） */
export function parseBlocksFromClipboardText(text: string): Block[] | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith("[")) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    return isBlockArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * 表格单元格内粘贴块 JSON 时压成纯文本插入，避免在 cell 内嵌套整块结构。
 * 返回 true 表示已消费该次 paste 事件。
 */
export function handleTableBlockPaste(
  view: EditorView,
  event: ClipboardEvent
): boolean {
  if (!isSelectionInTableCell(view)) {
    return false
  }

  const text = event.clipboardData?.getData("text/plain")
  if (!text) {
    return false
  }

  const blocks = parseBlocksFromClipboardText(text)
  if (!blocks) {
    return false
  }

  const plain = documentToPlainText(blocks)
  if (!plain) {
    return false
  }

  const { state, dispatch } = view
  dispatch(state.tr.insertText(plain))
  return true
}
