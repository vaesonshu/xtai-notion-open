import { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { createEditorExtensions } from "../extensions"
import { insertTable } from "./index"

function createEditor() {
  return new Editor({
    extensions: createEditorExtensions(),
  })
}

describe("insertTable", () => {
  it("inserts a table node with the requested dimensions and a header row", () => {
    const editor = createEditor()

    insertTable(editor, 3, 2)

    const json = editor.getJSON()
    // 文档根节点包含一个 table 块。
    const table = (json.content ?? []).find(
      (node) => node.type === "table"
    ) as { type: string; content?: unknown[] } | undefined

    expect(table).toBeDefined()
    expect(table?.type).toBe("table")

    const rows = (table?.content ?? []) as {
      type: string
      content?: unknown[]
    }[]
    expect(rows).toHaveLength(3)
    expect(rows[0]!.type).toBe("tableRow")

    const firstRowCells = rows[0]!.content ?? []
    expect(firstRowCells).toHaveLength(2)
    // 首行是表头单元格（withHeaderRow 为 true）。
    expect((firstRowCells[0] as { type: string }).type).toBe("tableHeader")
    expect((firstRowCells[1] as { type: string }).type).toBe("tableHeader")

    const secondRowCells = rows[1]!.content ?? []
    expect((secondRowCells[0] as { type: string }).type).toBe("tableCell")

    editor.destroy()
  })
})
