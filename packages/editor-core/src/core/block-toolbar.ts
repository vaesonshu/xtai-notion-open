import type { Node as PMNode } from "@tiptap/pm/model"
import type { EditorState } from "@tiptap/pm/state"

export type BlockToolbarCommand =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-block"

function blockContentToToolbarCommand(
  content: PMNode
): BlockToolbarCommand | null {
  switch (content.type.name) {
    case "paragraph":
      return "paragraph"
    case "heading": {
      const level = Number(content.attrs.level)

      if (level === 1) {
        return "heading-1"
      }

      if (level === 2) {
        return "heading-2"
      }

      return null
    }
    case "bulletListItem":
      return "bullet-list"
    case "numberedListItem":
      return "ordered-list"
    case "checkListItem":
      return "task-list"
    case "quote":
      return "blockquote"
    case "codeBlock":
      return "code-block"
    default:
      return null
  }
}

/** 从 ProseMirror 选区读取当前块对应的工具栏 command id */
export function getActiveBlockToolbarCommand(
  state: EditorState
): BlockToolbarCommand | null {
  const { from } = state.selection
  const $pos = state.doc.resolve(from)

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name !== "blockContainer") {
      continue
    }

    const content = $pos.node(depth).firstChild

    if (!content) {
      return "paragraph"
    }

    return blockContentToToolbarCommand(content)
  }

  return null
}
