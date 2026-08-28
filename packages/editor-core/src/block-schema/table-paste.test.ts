import { TextSelection } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { BlockEditor } from "../block-editor"
import { pmDocToBlocks } from "./convert"
import { handleTableBlockPaste } from "./table-paste"
import type { Block } from "./types"

const TABLE_BLOCK_ID = "11111111-1111-4111-8111-111111111111"

/** 构造含 1×1 表格的单块文档，便于聚焦单元格测粘贴 */
function createTableEditor() {
  return new BlockEditor({
    initialContent: [
      {
        id: TABLE_BLOCK_ID,
        type: "table",
        props: {},
        content: {
          headerRows: 1,
          rows: [
            {
              cells: [
                {
                  content: [{ type: "text", text: "", styles: {} }],
                },
              ],
            },
          ],
        },
        children: [],
      },
    ],
  })
}

/** 定位表格首格内段落起始位置，供 TextSelection 使用 */
function firstTableCellTextPos(editor: BlockEditor): number {
  let textPos = -1
  editor.tiptap.state.doc.descendants((node, pos) => {
    if (textPos >= 0) {
      return false
    }
    if (node.type.name === "tableHeader" || node.type.name === "tableCell") {
      textPos = pos + 2
      return false
    }
    return undefined
  })
  if (textPos < 0) {
    throw new Error("table cell text position not found")
  }
  return textPos
}

/** 从 Block[] 取出表格首格纯文本 */
function firstCellPlainText(editor: BlockEditor): string {
  const table = pmDocToBlocks(editor.tiptap.state.doc).find(
    (block) => block.type === "table"
  )
  const rows = (
    table?.content as { rows: { cells: { content: unknown[] }[] }[] }
  )?.rows
  const cellContent = rows?.[0]?.cells[0]?.content ?? []
  return cellContent
    .map((item) =>
      typeof item === "object" &&
      item !== null &&
      "text" in item &&
      typeof (item as { text: unknown }).text === "string"
        ? (item as { text: string }).text
        : ""
    )
    .join("")
}

describe("table block paste", () => {
  it("flattens pasted block JSON into plain text inside a table cell", () => {
    const editor = createTableEditor()
    const view = editor.tiptap.view
    const cellPos = firstTableCellTextPos(editor)

    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, cellPos))
    )

    const clipboardBlocks: Block[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "第一段", styles: {} }],
        children: [],
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "第二段", styles: {} }],
        children: [],
      },
    ]

    const event = {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? JSON.stringify(clipboardBlocks) : "",
      },
    } as ClipboardEvent

    const handled = handleTableBlockPaste(view, event)
    expect(handled).toBe(true)
    expect(firstCellPlainText(editor)).toBe("第一段\n第二段")
    expect(pmDocToBlocks(editor.tiptap.state.doc)).toHaveLength(1)

    editor.destroy()
  })
})
