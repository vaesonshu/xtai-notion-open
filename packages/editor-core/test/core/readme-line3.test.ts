import { describe, expect, it } from "vitest"
import { markdownToBlocks } from "@core/markdown"
import {
  createBlockSchemaYDoc,
  documentFromYjs,
} from "@core/yjs-document"

const README_LINE_3 =
  "面向团队与个人的 **Notion 式知识工作台**：以块（Block）为一等公民组织文档，内置实时协作、发布广场与文档关系图。编辑器内核拆分为可独立发布的 **MIT** SDK（`@xtai-notion/editor-*`），既可开箱即用，也可 Headless 嵌入自有产品。"

describe("README line 3 import", () => {
  it("parses bold and code inline marks", () => {
    const blocks = markdownToBlocks(README_LINE_3)
    const content = blocks[0]?.content ?? []
    const texts = content.filter(
      (item): item is Extract<(typeof content)[number], { type: "text" }> =>
        item.type === "text"
    )

    expect(texts.some((t) => t.text === "Notion 式知识工作台" && t.styles.bold)).toBe(
      true
    )
    expect(texts.some((t) => t.text === "MIT" && t.styles.bold)).toBe(true)
    expect(
      texts.some(
        (t) => t.text === "@xtai-notion/editor-*" && t.styles.code
      )
    ).toBe(true)
  })

  it("preserves inline marks through Yjs roundtrip", () => {
    const blocks = markdownToBlocks(README_LINE_3)
    const yDoc = createBlockSchemaYDoc(blocks)
    const restored = documentFromYjs(yDoc)
    const content = restored[0]?.content ?? []
    const texts = content.filter(
      (item): item is Extract<(typeof content)[number], { type: "text" }> =>
        item.type === "text"
    )

    expect(texts.some((t) => t.text === "MIT" && t.styles.bold)).toBe(true)
    expect(
      texts.some(
        (t) => t.text === "@xtai-notion/editor-*" && t.styles.code
      )
    ).toBe(true)
    yDoc.destroy()
  })
})
