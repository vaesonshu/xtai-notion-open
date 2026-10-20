import { describe, expect, it } from "vitest"
import {
  blocksToHtml,
  blocksToMarkdown,
  markdownToBlocks,
} from "@core/markdown"
import {
  clipboardHtmlHasRichStructure,
  looksLikeMarkdown,
} from "@core/markdown/detect"
import type { InlineContent } from "@core/block-schema/types"

function textStyles(blockIndex = 0) {
  const block = markdownToBlocks(
    "**bold** and *italic* and `code` and ***both***"
  )[blockIndex]
  return Array.isArray(block?.content) ? block.content : []
}

function isText(
  item: InlineContent
): item is Extract<InlineContent, { type: "text" }> {
  return item.type === "text"
}

describe("markdown roundtrip", () => {
  it("converts heading and list blocks to markdown and back", () => {
    const blocks = markdownToBlocks(
      "# Title\n\nHello world\n\n- item one\n\n> quote line"
    )
    const markdown = blocksToMarkdown(blocks)
    expect(markdown).toContain("# Title")
    expect(markdown).toContain("Hello world")
    expect(markdown).toContain("- item one")
    expect(markdown).toContain("> quote line")
  })

  it("parses inline bold italic and code marks", () => {
    const content = textStyles()
    const texts = content.filter(isText)
    expect(texts).toEqual(
      expect.arrayContaining([
        { type: "text", text: "bold", styles: { bold: true } },
        { type: "text", text: "italic", styles: { italic: true } },
        { type: "text", text: "code", styles: { code: true } },
        {
          type: "text",
          text: "both",
          styles: { bold: true, italic: true },
        },
      ])
    )
    const markdown = blocksToMarkdown(markdownToBlocks("**bold**"))
    expect(markdown).toContain("**bold**")
  })

  it("serializes tables to GFM markdown", () => {
    const source = "| Name | Count |\n| --- | --- |\n| **A** | 1 |"
    const markdown = blocksToMarkdown(markdownToBlocks(source))
    expect(markdown).toContain("| Name | Count |")
    expect(markdown).toContain("| --- | --- |")
    expect(markdown).toContain("**A**")
  })

  it("parses bold links inside table cells", () => {
    const blocks = markdownToBlocks(
      "| Name |\n| --- |\n| **[Tiptap](https://tiptap.dev)** |"
    )
    const table = blocks[0]
    expect(table?.type).toBe("table")
    const cell = (
      table?.content as { rows: { cells: { content: InlineContent[] }[] }[] }
    )?.rows[1]?.cells[0]?.content
    expect(cell?.[0]).toMatchObject({
      type: "link",
      href: "https://tiptap.dev",
    })
    expect(
      cell?.[0]?.type === "link" &&
        cell[0].content.some(
          (item) =>
            item.type === "text" && item.text === "Tiptap" && item.styles.bold
        )
    ).toBe(true)
  })
})

describe("html export", () => {
  it("renders headings and tables as html", () => {
    const blocks = markdownToBlocks("# Title\n\n| A |\n| --- |\n| 1 |")
    const html = blocksToHtml(blocks)
    expect(html).toContain("<h1>Title</h1>")
    expect(html).toContain("<table>")
    expect(html).toContain("<td>1</td>")
  })
})

describe("markdown detect", () => {
  it("recognizes markdown prefixes and ignores plain sentences", () => {
    expect(looksLikeMarkdown("# Title")).toBe(true)
    expect(looksLikeMarkdown("- item")).toBe(true)
    expect(looksLikeMarkdown("```ts\nconst a = 1\n```")).toBe(true)
    expect(looksLikeMarkdown("hello world")).toBe(false)
  })

  it("treats structured html as rich and simple wrappers as not", () => {
    expect(clipboardHtmlHasRichStructure("<ul><li>a</li></ul>")).toBe(true)
    expect(clipboardHtmlHasRichStructure("<p># Title</p>")).toBe(false)
  })
})
