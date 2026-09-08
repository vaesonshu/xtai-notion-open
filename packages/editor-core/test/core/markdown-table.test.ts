import { describe, expect, it } from "vitest"
import { markdownToBlocks } from "@core/markdown"
import type {
  Block,
  InlineContent,
  TableContent,
} from "@core/block-schema/types"
import { createBlockSchemaYDoc, documentFromYjs } from "@core/yjs-document"

const README_TABLE = `| 参考项目 | 在本仓库中的角色 |
|----------|------------------|
| **[Tiptap](https://tiptap.dev)** | 编辑内核：ProseMirror 封装、扩展体系、Yjs 协作集成 |
| **[BlockNote](https://www.blocknotejs.org)** | 块模型与 UX：\`Block[]\` 对外 API、每块 UUID、斜杠菜单、块级 Enter / Backspace |`

function tableContent(block: Block | undefined): TableContent | undefined {
  if (!block?.content || !("rows" in block.content)) return undefined
  return block.content
}

function cellInline(rowIndex: number, cellIndex: number, blocks: Block[]) {
  return tableContent(blocks.find((block) => block.type === "table"))?.rows[
    rowIndex
  ]?.cells[cellIndex]?.content
}

function hasBoldLink(
  content: InlineContent[] | undefined,
  label: string,
  hrefPart: string
) {
  return content?.some(
    (item) =>
      item.type === "link" &&
      item.href.includes(hrefPart) &&
      item.content.some(
        (child) =>
          child.type === "text" && child.text === label && child.styles.bold
      )
  )
}

describe("markdown table import", () => {
  it("parses README reference table as a table block", () => {
    const blocks = markdownToBlocks(README_TABLE)
    const table = blocks.find((block) => block.type === "table")
    const content = tableContent(table)

    expect(table?.type).toBe("table")
    expect(content?.headerRows).toBe(1)
    expect(content?.rows).toHaveLength(3)
    expect(cellInline(0, 0, blocks)?.[0]).toMatchObject({
      type: "text",
      text: "参考项目",
    })
    expect(hasBoldLink(cellInline(1, 0, blocks), "Tiptap", "tiptap.dev")).toBe(
      true
    )
    expect(
      hasBoldLink(cellInline(2, 0, blocks), "BlockNote", "blocknotejs.org")
    ).toBe(true)
    expect(
      cellInline(2, 1, blocks)?.some(
        (item) =>
          item.type === "text" && item.styles.code && item.text === "Block[]"
      )
    ).toBe(true)
  })

  it("preserves table structure through Yjs roundtrip", () => {
    const blocks = markdownToBlocks(README_TABLE)
    const yDoc = createBlockSchemaYDoc(blocks)
    const restored = documentFromYjs(yDoc)
    const table = restored.find((block) => block.type === "table")

    expect(tableContent(table)?.rows).toHaveLength(3)
    expect(
      hasBoldLink(cellInline(1, 0, restored), "Tiptap", "tiptap.dev")
    ).toBe(true)
    yDoc.destroy()
  })
})
