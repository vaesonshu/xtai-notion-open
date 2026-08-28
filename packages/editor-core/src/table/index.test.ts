import { Editor } from "@tiptap/core"
import type { JSONContent } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { blocksToPmDoc } from "../block-schema/convert"
import { createEmptyBlocks } from "../block-schema/documents"
import { createEditorExtensions } from "../extensions"
import { insertTable } from "./index"

function findNodeByType(
  node: JSONContent,
  type: string
): JSONContent | undefined {
  if (node.type === type) {
    return node
  }
  for (const child of node.content ?? []) {
    const found = findNodeByType(child, type)
    if (found) {
      return found
    }
  }
  return undefined
}

function createEditor() {
  const extensions = createEditorExtensions()
  const editor = new Editor({
    extensions,
    content: blocksToPmDoc(
      createEmptyBlocks(),
      new Editor({ extensions }).schema
    ).toJSON() as JSONContent,
  })
  editor.commands.setTextSelection(3)
  return editor
}

describe("insertTable", () => {
  it("inserts a table node with the requested dimensions and a header row", () => {
    const editor = createEditor()

    insertTable(editor, 3, 2)

    const json = editor.getJSON()
    const table = findNodeByType(json, "table")

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
    expect((firstRowCells[0] as { type: string }).type).toBe("tableHeader")
    expect((firstRowCells[1] as { type: string }).type).toBe("tableHeader")

    const secondRowCells = rows[1]!.content ?? []
    expect((secondRowCells[0] as { type: string }).type).toBe("tableCell")

    editor.destroy()
  })
})
