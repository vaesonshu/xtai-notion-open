import type { Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"

/** 默认段落占位文案，可通过 EditorExtensionOptions.placeholder 覆盖 */
export const DEFAULT_PARAGRAPH_PLACEHOLDER = "输入 / 查看块类型"

type PlaceholderContext = {
  editor: Editor
  node: PMNode
  pos: number
}

/** 判断段落是否位于表格单元格内（单元格内用更短的提示） */
function isParagraphInTable(editor: Editor, pos: number): boolean {
  const doc = editor.state.doc
  if (pos < 0 || pos > doc.content.size) {
    return false
  }

  try {
    const $pos = doc.resolve(pos)

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === "table") {
        return true
      }
    }
  } catch {
    return false
  }

  return false
}

/** 按 blockContent 节点类型返回空块占位提示 */
export function resolveBlockPlaceholder(
  { editor, node, pos }: PlaceholderContext,
  paragraphPlaceholder = DEFAULT_PARAGRAPH_PLACEHOLDER
): string {
  switch (node.type.name) {
    case "paragraph":
      return isParagraphInTable(editor, pos)
        ? "输入内容"
        : paragraphPlaceholder
    case "heading": {
      const level = node.attrs.level as number
      if (level === 2) return "标题 2"
      if (level === 3) return "标题 3"
      return "标题 1"
    }
    case "quote":
      return "引用"
    case "bulletListItem":
    case "numberedListItem":
      return "列表"
    case "checkListItem":
      return "待办"
    case "codeBlock":
      return "输入代码"
    default:
      return paragraphPlaceholder
  }
}
