import type { Editor } from "@tiptap/core"

/** 在光标处插入一个 rows × cols 的表格，默认带表头行。 */
export function insertTable(
  editor: Editor,
  rows: number,
  cols: number
): boolean {
  return editor
    .chain()
    .focus()
    .insertTable({ rows, cols, withHeaderRow: true })
    .run()
}
