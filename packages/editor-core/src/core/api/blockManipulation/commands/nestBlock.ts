import type { Editor } from "@tiptap/core"
import { buildNestBlockTransaction } from "../nesting"

/** Tab 缩进：将选区所在块嵌套到上一同级或加深一层 */
export function nestBlock(editor: Editor): boolean {
  const tr = buildNestBlockTransaction(editor.state)
  if (!tr) {
    return false
  }

  editor.view.dispatch(tr)
  return true
}
