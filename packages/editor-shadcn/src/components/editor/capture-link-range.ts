import type { Editor } from "@tiptap/core"
import { TextSelection } from "@tiptap/pm/state"
import {
  normalizeLinkHref,
  setEditorLink,
} from "@xtai-notion/editor-core/commands"

export type LinkMarkRange = { from: number; to: number }

function clampLinkRange(
  editor: Editor,
  range: LinkMarkRange
): LinkMarkRange | null {
  const docSize = editor.state.doc.content.size
  const from = Math.max(0, Math.min(range.from, docSize))
  const to = Math.max(from + 1, Math.min(range.to, docSize))

  if (from >= to) {
    return null
  }

  return { from, to }
}

/** 根据 DOM 锚点记录 link mark 范围，供弹层内修改 href 后写回 */
export function captureLinkMarkRange(
  editor: Editor,
  link: HTMLAnchorElement
): LinkMarkRange | null {
  const pos = editor.view.posAtDOM(link, 0)
  if (pos < 0) {
    return null
  }

  const applied = editor
    .chain()
    .setTextSelection(pos)
    .extendMarkRange("link")
    .run()

  if (!applied) {
    return null
  }

  const { from, to } = editor.state.selection
  if (from >= to) {
    return null
  }

  return { from, to }
}

/** 恢复选区并写回 link href，避免 chain 收到 undefined range 导致崩溃 */
export function applyLinkAtRange(
  editor: Editor,
  range: LinkMarkRange | null | undefined,
  href: string
): boolean {
  if (!range || typeof range.from !== "number" || typeof range.to !== "number") {
    return false
  }

  const clamped = clampLinkRange(editor, range)
  if (!clamped) {
    return false
  }

  const selectionSet = editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        tr.setSelection(
          TextSelection.create(tr.doc, clamped.from, clamped.to)
        )
      }
      return true
    })
    .run()

  if (!selectionSet) {
    return false
  }

  return setEditorLink(editor, href)
}
