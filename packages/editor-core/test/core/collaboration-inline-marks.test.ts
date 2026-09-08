import { afterEach, describe, expect, it } from "vitest"
import * as Y from "yjs"
import { BlockEditor } from "@core/block-editor"
import { markdownToBlocks } from "@core/markdown"
import { createBlockSchemaYDoc } from "@core/yjs-document"

const README_LINE_3 =
  "面向团队与个人的 **Notion 式知识工作台**：以块（Block）为一等公民组织文档，内置实时协作、发布广场与文档关系图。编辑器内核拆分为可独立发布的 **MIT** SDK（`@xtai-notion/editor-*`），既可开箱即用，也可 Headless 嵌入自有产品。"

const editors: BlockEditor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("BlockEditor collaboration load", () => {
  it("preserves imported inline marks from seeded Y.Doc", () => {
    const blocks = markdownToBlocks(README_LINE_3)
    const seeded = createBlockSchemaYDoc(blocks)
    const document = new Y.Doc()
    Y.applyUpdate(document, Y.encodeStateAsUpdate(seeded))
    seeded.destroy()

    const editor = new BlockEditor({
      applyInitialContent: false,
      extensions: { document },
    })
    editors.push(editor)

    const content = editor.document[0]?.content ?? []
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
    expect(texts.some((t) => t.text.includes("**"))).toBe(false)

    document.destroy()
  })
})
