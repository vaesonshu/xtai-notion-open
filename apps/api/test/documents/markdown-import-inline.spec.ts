import { describe, expect, it } from "vitest"
import {
  createBlockSchemaYDoc,
  documentFromYjs,
  markdownToBlocks,
} from "@xtai-notion/editor-core/server"
import type { Block } from "@xtai-notion/editor-core/server"

/** README 第 3 段：导入时应解析 **bold** 与 `code`，而非保留 Markdown 字面量 */
const README_LINE_3 =
  "面向团队与个人的 **Notion 式知识工作台**：以块（Block）为一等公民组织文档，内置实时协作、发布广场与文档关系图。编辑器内核拆分为可独立发布的 **MIT** SDK（`@xtai-notion/editor-*`），既可开箱即用，也可 Headless 嵌入自有产品。"

const README_TABLE = `| 参考项目 | 在本仓库中的角色 |
|----------|------------------|
| **[Tiptap](https://tiptap.dev)** | 编辑内核：ProseMirror 封装、扩展体系、Yjs 协作集成 |
| **[BlockNote](https://www.blocknotejs.org)** | 块模型与 UX：\`Block[]\` 对外 API |`

function textNodes(block: Block | undefined) {
  if (!block || !Array.isArray(block.content)) return []
  return block.content.filter(
    (item): item is Extract<(typeof block.content)[number], { type: "text" }> =>
      item.type === "text"
  )
}

describe("markdown import inline marks (server entry)", () => {
  it("parses bold and code via @xtai-notion/editor-core/server", () => {
    const blocks = markdownToBlocks(README_LINE_3)
    const texts = textNodes(blocks[0])

    expect(texts.some((t) => t.text === "MIT" && t.styles.bold)).toBe(true)
    expect(
      texts.some((t) => t.text === "@xtai-notion/editor-*" && t.styles.code)
    ).toBe(true)
    expect(texts.some((t) => t.text.includes("**"))).toBe(false)
  })

  it("preserves inline marks when seeding Yjs snapshot", () => {
    const yDoc = createBlockSchemaYDoc(markdownToBlocks(README_LINE_3))
    const restored = documentFromYjs(yDoc)
    const texts = textNodes(restored[0])

    expect(texts.some((t) => t.text === "MIT" && t.styles.bold)).toBe(true)
    yDoc.destroy()
  })

  it("parses GFM pipe tables from README", () => {
    const blocks = markdownToBlocks(README_TABLE)
    const table = blocks.find((block) => block.type === "table")
    expect(table?.type).toBe("table")
    const content = table?.content
    expect(content && "rows" in content ? content.rows.length : 0).toBe(3)
    expect(content && "headerRows" in content ? content.headerRows : 0).toBe(1)
  })
})
