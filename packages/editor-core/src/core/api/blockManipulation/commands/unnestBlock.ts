import type { Editor } from "@tiptap/core"
import { buildUnnestBlockTransaction } from "../nesting"

/** Shift+Tab：将选区所在子块升到父级之后 */
export function unnestBlock(editor: Editor): boolean {
  const tr = buildUnnestBlockTransaction(editor.state)
  if (!tr) {
    return false
  }

  editor.view.dispatch(tr)
  return true
}
