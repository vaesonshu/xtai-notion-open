import { describe, expect, it } from "vitest"
import { blocksToMarkdown, markdownToBlocks } from "@core/markdown"
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
